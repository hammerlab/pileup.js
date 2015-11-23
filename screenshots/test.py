from seltest import url, waitforjs, hide, Base


PILEUP_RENDERED_JS = '''
return document.querySelector('.track.pileup canvas') && document.querySelector('.track.pileup canvas').height > 100
'''


class Pileup(Base):
    host = 'localhost:8080'
    base_url = 'examples/'
    window_size = (1280, 768)

    @url('?pos=chr17:7,512,374-7,512,554')
    @hide('#stats')
    @waitforjs(PILEUP_RENDERED_JS)
    def loose(self, driver):
        pass

    @url('?pos=chr17:7,514,241-7,514,331')
    @hide('#stats')
    @waitforjs(PILEUP_RENDERED_JS)
    def small_letters_mismatch(self, driver):
        pass

    @url('?pos=chr17:7,514,181-7,514,411')
    @hide('#stats')
    @waitforjs(PILEUP_RENDERED_JS)
    def blocks_mismatch(self, driver):
        pass

    @url('?pos=chr17:7,511,774-7,514,654')
    @hide('#stats')
    @waitforjs(PILEUP_RENDERED_JS)
    def gene_utf(self, driver):
        pass

    @url('?pos=chr17:7,513,279-7,513,459')
    @hide('#stats')
    @waitforjs(PILEUP_RENDERED_JS)
    def deletions(self, driver):
        pass

    @url('?pos=chr17:7,514,550-7,514,640')
    @hide('#stats')
    @waitforjs(PILEUP_RENDERED_JS)
    def inserts(self, driver):
        pass

    @url('?pos=chr17:7,514,000-7,515,000')
    @hide('#stats')
    @waitforjs(PILEUP_RENDERED_JS)
    def wide(self, driver):
        pass


class StructuralVariants(Base):
    host = 'localhost:8080'
    base_url = 'examples/structural-variants.html'
    window_size = (1280, 768)

    @url('')
    @hide('#stats')
    @waitforjs(PILEUP_RENDERED_JS)
    def base(self, driver):
        pass

    @url('?pos=chr1:4,938,510-4,938,770&colorByStrand=1')
    @hide('#stats')
    @waitforjs(PILEUP_RENDERED_JS)
    def strands(self, driver):
        pass
