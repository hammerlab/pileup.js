This directory contains many small data files used in testing.

This file documents how they were generated.


#### test.2bit

This is a small subset of the hg19 reference genome. It contains small swaths
of chr1 and chr22 and a larger swath of chr17. It was generated from hg19.2bit
using UCSC tools:

    curl -O http://www.biodalliance.org/datasets/hg19.2bit
    twoBitToFa -seqList=./test/data/seqList.txt hg19.2bit /tmp/extract.fa
    perl -i -pe 's/:.*//' /tmp/extract.fa
    faToTwoBit /tmp/extract.fa test/data/test.2bit


#### itemRgb.bb, itemRgb.bed

This file was generated from UCSC test data:

    cd kent/src/utils/bedToBigBed/tests
    make
    cp output/itemRgb.bb $PILEUP/test/data/

It is compressed, little endian, has autoSQL and two blocks.

`itemRgb.bed` is copied unmodified from `bedToBigBed/tests/input`.


#### ensembl.chr17.bb

This file is derived from `ensGene.bb`. It contains just the genes on chr17.

    curl -O http://www.biodalliance.org/datasets/ensGene.bb
    bigBedToBed ensGene.bb ensGene.bed
    grep '^chr17\t' ensGene.bed > /tmp/ensGene17.bed
    bedToBigBed -type=bed12+2 /tmp/ensGene17.bed <(echo "chr17 78774742") test/data/ensembl.chr17.bb

#### tp53.shifted.bb

This is a subset of `ensembl.chr17.bb`, shifted to match the coordinates in
`test.2bit`:

    curl -O http://www.biodalliance.org/datasets/ensGene.bb
    bigBedToBed ensGene.bb ensGene.bed
    grep '^chr17\t' ensGene.bed | grep TP53 | perl -pe 's/(75\d{4,})/$1-7512444/ge' > /tmp/tp53.shifted.bed
    bedToBigBed -type=bed12+2 /tmp/tp53.shifted.bed <(echo "chr17 78774742") test/data/tp53.shifted.bb

#### test_input_1*

These BAM and BAI files come from the [samtools][1] tests. You can find
corresponding SAM files for them in the same repo.

[1]: https://github.com/samtools/samtools/tree/develop/test/dat
