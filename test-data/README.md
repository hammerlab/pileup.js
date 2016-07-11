This directory contains many small data files used in testing.

This file documents how they were generated.

#### test.2bit

This is a small subset of the hg19 reference genome. It contains small swaths
of chr1 and chr22 and a larger swath of chr17. It was generated from hg19.2bit
using UCSC tools:

    curl -O http://www.biodalliance.org/datasets/hg19.2bit
    twoBitToFa -seqList=./test-data/seqList.txt hg19.2bit /tmp/extract.fa
    perl -i -pe 's/:.*//' /tmp/extract.fa
    faToTwoBit /tmp/extract.fa test-data/test.2bit


#### itemRgb.bb, itemRgb.bed

This file was generated from UCSC test data:

    cd kent/src/utils/bedToBigBed/tests
    make
    cp output/itemRgb.bb $PILEUP/test-data/

It is compressed, little endian, has autoSQL and two blocks.

`itemRgb.bed` is copied unmodified from `bedToBigBed/tests/input`.


#### ensembl.chr17.bb

This file is derived from `ensGene.bb`. It contains just the genes on chr17.

    curl -O http://www.biodalliance.org/datasets/ensGene.bb
    bigBedToBed ensGene.bb ensGene.bed
    grep '^chr17\t' ensGene.bed > /tmp/ensGene17.bed
    bedToBigBed -type=bed12+2 /tmp/ensGene17.bed <(echo "chr17 78774742") test-data/ensembl.chr17.bb

#### tp53.shifted.bb

This is a subset of `ensembl.chr17.bb`, shifted to match the coordinates in
`test.2bit`:

    curl -O http://www.biodalliance.org/datasets/ensGene.bb
    bigBedToBed ensGene.bb ensGene.bed
    grep '^chr17\t' ensGene.bed | grep TP53 | perl -pe 's/(75\d{4,})/$1-7512444/ge' > /tmp/tp53.shifted.bed
    bedToBigBed -type=bed12+2 /tmp/tp53.shifted.bed <(echo "chr17 78774742") test-data/tp53.shifted.bb

#### simple17*.{bed,bb}

- `simple17.bed`: the first 10 features from chr17 of ensGene.bb, and only including the first 3 columns.
- `simple17.bb`: `simple17.bed` as a BigBed with compressed data: `bedToBigBed -type=bed3 simple17.bed <(echo "chr17 78774742") simple17.bb`.
- `simple17.bb`: `simple17.bed` as a BigBed with uncompressed data: `bedToBigBed -type=bed3 -unc simple17.bed <(echo "chr17 78774742") simple17unc.bb`.

#### test_input_1*

These BAM and BAI files come from the [samtools][1] tests. You can find
corresponding SAM files for them in the same repo.

#### chr17.1-250.bam, chr17.1-250.json

This was hand-edited from the SAM equivalent of `test_input_1_a.bam` to have
reads in chr17:1-250. It was then converted back to BAM/BAI using `samtools view`.

The JSON variant was formed by loading `chr17.1-250.bam` into v0.5.1 of the [GA4GH demo server][ga4gh] and querying for all the reads via:

    curl --data '{"readGroupIds":["pileup.js:chr17.1-250"]}' --header 'Content-Type: application/json' http://localhost:8000/v0.5.1/reads/search > chr17.1-250.json

#### index_test.bam

This BAM/BAI file pair comes from [htsjdk][2] tests.

#### dream.synth3.bam.mapped

This BAM/BAI pair comes from the [ICGC-TCGA DREAM Mutation Calling
challenge][3]. It's the synth3.normal data set with MDTags added. The BAM and
BAI files have been reduced to a small portion of the originals using
`scripts/generate_mapped_file.py`.


[1]: https://github.com/samtools/samtools/tree/develop/test/dat
[2]: https://github.com/samtools/htsjdk/blob/afecd5fa959087d5bdd5d5a701e415a72d629282/testdata/htsjdk/samtools/BAMFileIndexTest/index_test.bam
[3]: https://www.synapse.org/#%21Synapse:syn312572
[ga4gh]: http://ga4gh-reference-implementation.readthedocs.org/en/stable/index.html
