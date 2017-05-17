#!/usr/bin/env python2.7

import numpy
import torrentPy
from copy import deepcopy

import sys
import os
import cgi
import cgitb; cgitb.enable() # Optional; good for debugging

import simplejson as json

import pprint
pp = pprint.PrettyPrinter(indent=2)

from tempfile import TemporaryFile

# -----------------------------------------------------------------------
#
# Generates Reference sequence for aligned portion of read from cigar and md tag
# Output:  tseq_bases : refernce (target) bases for aligned portion of the read
#          qseq_bases : read (query) bases for aligned portion of the read
#         pretty_tseq : padded (incl. '-' gaps) target sequence
#         pretty_qseq : padded (incl. '-' gaps) target sequence
#          pretty_aln : Alignment operations for pretty strings
#             left_sc : amount of soft clipped bases on the left side
#            right_sc : amount of soft clipped bases on the right side

BAM_CIGAR_MATCH_CHAR = 'M'
BAM_CIGAR_INS_CHAR = 'I'
BAM_CIGAR_DEL_CHAR = 'D'
BAM_CIGAR_REFSKIP_CHAR = 'N'
BAM_CIGAR_SOFTCLIP_CHAR = 'S'
BAM_CIGAR_HARDCLIP_CHAR = 'H'
BAM_CIGAR_PAD_CHAR = 'P'
BAM_CIGAR_SEQMATCH_CHAR = '='
BAM_CIGAR_MISMATCH_CHAR = 'X'


def isReverse (read):
    return (read['aligned_flag'] & 16 == 16)


def ReverseComplement (sequence):
    trans = {
      'A': 'T',
      'C': 'G',
      'G': 'C',
      'T': 'A',
      'a': 't',
      'c': 'g',
      'g': 'c',
      't': 'a'
    }

    comp = []
    for base in sequence:
        comp.append(trans.get(base) or base)

    return "".join(reversed(comp))

def RetrieveBaseAlignment(alignment_query_bases, alignment_cigar_data, md_tag):
    #
    # Step 1. Generate reference sequence based on QueryBases and Cigar alone
    #
    tseq_bases = []
    qseq_bases = []
    pretty_tseq = []
    pretty_qseq = []
    pretty_aln = []


    #  const char *read_ptr = alignment_query_bases.c_str();
    read_ptr = 0
    match_found = False
    left_sc = right_sc = 0

    for cigar in alignment_cigar_data:
        if cigar['Type'] in (BAM_CIGAR_MATCH_CHAR, BAM_CIGAR_SEQMATCH_CHAR, BAM_CIGAR_MISMATCH_CHAR):
            chunk = list(alignment_query_bases[read_ptr: read_ptr + cigar['Length']])
            tseq_bases.extend(chunk)
            qseq_bases.extend(chunk)
            pretty_tseq.extend(chunk)
            pretty_qseq.extend(chunk)
            pretty_aln.extend(cigar['Length'] * '|')
            match_found = True
            read_ptr += cigar['Length']

        elif cigar['Type'] == BAM_CIGAR_INS_CHAR:
            chunk = list(alignment_query_bases[read_ptr: read_ptr + cigar['Length']])
            qseq_bases.extend(chunk)
            pretty_tseq.extend(cigar['Length'] * '-')
            pretty_qseq.extend(chunk)
            pretty_aln.extend(cigar['Length'] * '+')
            read_ptr += cigar['Length']

        elif cigar['Type'] == BAM_CIGAR_SOFTCLIP_CHAR:
            #chunk = list(alignment_query_bases[read_ptr: read_ptr + cigar['Length']])
            #qseq_bases.extend(chunk)
            read_ptr += cigar['Length']
            if (match_found):
              right_sc = cigar['Length']
            else:
              left_sc = cigar['Length']

        elif cigar['Type'] in (BAM_CIGAR_DEL_CHAR, BAM_CIGAR_PAD_CHAR, BAM_CIGAR_REFSKIP_CHAR):
            tseq_bases.extend(cigar['Length'] * '-')
            pretty_tseq.extend(cigar['Length'] * '-')
            pretty_qseq.extend(cigar['Length'] * '-')
            pretty_aln.extend(cigar['Length'] * '-')


    #
    # Step 2: Further patch the sequence based on MD tag
    #

    # char *ref_ptr = (char *)tseq_bases.c_str();
    ref_ptr = 0
    pretty_idx = 0

    # const char *MD_ptr = md_tag.c_str();
    MD_ptr = 0

    while (MD_ptr < len(md_tag) and ref_ptr < len(tseq_bases)):
        if (ord(md_tag[MD_ptr]) >= ord('0') and ord(md_tag[MD_ptr]) <= ord('9')):    # It's a match
            item_length = 0
            while (MD_ptr < len(md_tag) and ord(md_tag[MD_ptr]) >= ord('0') and ord(md_tag[MD_ptr]) <= ord('9')):
                item_length = 10 * item_length + ord(md_tag[MD_ptr]) - ord('0')
                MD_ptr += 1
            ref_ptr += item_length;
            while (pretty_idx < len(pretty_aln) and (item_length > 0 or ord(pretty_aln[pretty_idx]) == ord('+'))):
                if (ord(pretty_aln[pretty_idx]) != ord('+')):
                    item_length -= 1;
                pretty_idx += 1;
        else:
            if (ord(md_tag[MD_ptr]) == ord('^')):      # It's a deletion or substitution
                MD_ptr += 1

            while (ref_ptr < len(tseq_bases) and ord(md_tag[MD_ptr]) >= ord('A') and ord(md_tag[MD_ptr]) <= ord('Z')):
                if (pretty_aln[pretty_idx] == ord('|')):
                    pretty_aln[pretty_idx] = ord(' ')
                pretty_tseq[pretty_idx] = chr(ord(md_tag[MD_ptr]) + ord('a') - ord('A')) # lower the case
                tseq_bases[ref_ptr] = md_tag[MD_ptr]
                pretty_idx += 1
                ref_ptr += 1
                MD_ptr += 1

    return ("".join(tseq_bases), "".join(qseq_bases), "".join(pretty_tseq), "".join(pretty_qseq), "".join(pretty_aln), left_sc, right_sc)


#def FlowsToBases(flowgram, flow_order_arg)
#    base_index = 0;
#
#    flow_to_base_index = [-1 for x in range(len(flowgram)]
#
#    if (flow_order_arg != "default"):
#        flow_order = "TACGTACGTCTGAGCATCGATCGATGTACAGC"; // the Samba flow order
#    else:
#        flow_order = flow_order_arg;
#
#    for flow in range(len(flowgram)):
#        if (flowgram[flow] > 0):
#            flow_to_base_index[flow] = base_index;
#            for merism in range(flowgram(int num_of_mer = 0; num_of_mer < flowgram[flow]; ++num_of_mer){
#                base_seq[base_index] = flow_order[flow % flow_order.size()];
#                base_index ++;
#            }
#        }
#    }
#    return base_seq;
#}

def byteify(input):
    if isinstance(input, dict):
        return {byteify(key): byteify(value)
            for key, value in input.iteritems()}
    elif isinstance(input, list):
        return [byteify(element) for element in input]
    elif isinstance(input, unicode):
        return input.encode('utf-8')
    else:
        return input

######################## Here's where things start happening ###########################'
print "Content-type: application/json\n"

length = int(os.environ.get('CONTENT_LENGTH', '0'))
stdin = sys.stdin.read(length)

log = open("/tmp/flowgram.json", 'w')
log.write(stdin)
log.close()

input = json.loads(stdin)

tseq_bases, qseq_bases, pretty_tseq, pretty_qseq, pretty_aln, left_sc, right_sc = RetrieveBaseAlignment(
  input['seq'],
  input['cigarOps'],
  input['MD']
)

if (input.has_key("signal")):
    # Torrent flowgram
    bam_reader = torrentPy.BamReader(input['bam'])

    # Get key sequence and flow order from the header
    groupIndex = bam_reader.ReadBamHeader()['ID'].index(input['RG'])
    flowOrder = list(bam_reader.ReadBamHeader()['FlowOrder'][groupIndex])
    keySequence = list(bam_reader.ReadBamHeader()['KeySequence'][groupIndex])

    zt = ''
    if ('ZT' in input.keys()):
        zt = input['ZT']

    yt = ''
    if ('YT' in input.keys() and input['ZA'] - len(input['seq']) + len(input['YT']) > 0):
        yt = input['YT']

    bam_read = {
      'aligned_flag': input['flag'],
      'keySeq': keySequence,
      'meas': numpy.array(input['signal'], dtype=numpy.int16),
      'phase': numpy.array(input['phase'], dtype=numpy.float32),
      'readGroup': input['RG']
    }
    bam_read['phase'][2] = 0 # the droop parameter is not used

    #sys.stderr.write('yt: ' + yt)
    if (isReverse(bam_read)):
        bam_read['qseq_bases'] = zt + ReverseComplement(input['seq']) + yt
        bam_read['tseq_bases'] = zt + bam_read['qseq_bases'][0 : right_sc] + ReverseComplement(tseq_bases) + (bam_read['qseq_bases'][-left_sc:] if left_sc else '') + yt
        pretty_qseq = ReverseComplement(pretty_qseq)
        pretty_aln = ReverseComplement(pretty_aln)
        pretty_tseq = ReverseComplement(pretty_tseq)
    else:
        bam_read['qseq_bases'] = zt + input['seq'] + yt
        bam_read['tseq_bases'] = zt + input['seq'][0 : left_sc] + tseq_bases + (input['seq'][-right_sc:] if right_sc else '') + yt

    # Simulate the phasing effect
    bam_read['keySeq'] = keySequence

    bam_reader.SimulateCafie(bam_read)

    meas =  bam_read['meas'] / 256.0

    residuals_q_read = meas - bam_read['qseq_read'][0: len(bam_read['meas'])]
    residuals_t_read = meas - bam_read['tseq_read'][0: len(bam_read['meas'])]


    # Build base-to-flow index
    flow_map = torrentPy.seqToFlow(
      "".join(keySequence + list(zt) + list(ReverseComplement(input['seq']) if isReverse(bam_read) else input['seq'])),
      "".join(flowOrder)
    )

    # Do a finer version of the above calculation of key_flows to determine
    # flow length of the entire key sequence.
    k = 0
    prefix_flows = 0
    prefix = bam_read['keySeq'] + list(zt)
    for i, base in enumerate(flowOrder):
        if k >= len(prefix):
            break
        prefix_flows += 1
        if base == prefix[k]:
            k += flow_map[i]

    if (isReverse(bam_read)):
        tseq = bam_read['qseq_bases'][0 : right_sc] + ReverseComplement(tseq_bases) + (bam_read['qseq_bases'][-left_sc:] if left_sc else '')
    else:
        tseq = bam_read['qseq_bases'][0 : left_sc] + tseq_bases + (bam_read['qseq_bases'][-right_sc:] if right_sc else '')

    # Simulate reference flows
    ideal_flowgram = torrentPy.seqToFlow(
      "".join(keySequence + list(tseq)),
      "".join(flowOrder)
    )

    output = {
      'key_sequence': ''.join(keySequence),
      'prefix': ''.join(prefix),
      'flow_order': flowOrder,
      'tseq_bases': tseq_bases,
      'qseq_bases': qseq_bases,
      'pretty_tseq': pretty_tseq,
      'pretty_qseq': pretty_qseq,
      'soft_clip': [left_sc, right_sc],
      'pretty_qseq': pretty_qseq,
      'solution_pred': bam_read['qseq_read'].tolist(),
      'reference_pred': bam_read['tseq_read'].tolist(),
      'solution_res': residuals_q_read.tolist(),
      'reference_res':residuals_t_read.tolist(),
      'base_call': flow_map.tolist(),
      'ideal_flowgram': ideal_flowgram.tolist(),
      'prefix_flows': prefix_flows,
      'signal': input['signal']
    }

else:
    # no flowgram
    output = {
      'tseq_bases': tseq_bases,
      'qseq_bases': qseq_bases,
      'pretty_tseq': pretty_tseq,
      'pretty_qseq': pretty_qseq,
      'soft_clip': [left_sc, right_sc],
      'pretty_qseq': pretty_qseq
    }

print json.dumps(output)

