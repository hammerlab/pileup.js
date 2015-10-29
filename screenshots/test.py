from seltest import url, waitfor, hide, Base
from selenium.webdriver.support.ui import Select, WebDriverWait
import sys

PILEUP_RENDERED_JS = '''
return document.querySelector('.track.pileup canvas') && document.querySelector('.track.pileup canvas').height > 100
'''

def _pileup_is_rendered(driver):
    return driver.execute_script(PILEUP_RENDERED_JS)


def wait_for_pileup(driver):
    driver.implicitly_wait(0)
    WebDriverWait(driver, 120).until(_pileup_is_rendered, 'pileup timed out')
    driver.implicitly_wait(120)


class Pileup(Base):
    base_url = 'localhost:8080'
    window_size = (1280, 768)

    @url('/examples/?pos=chr17:7,512,374-7,512,554')
    @hide('#stats')
    def loose(self, driver):
        wait_for_pileup(driver)

    @url('/examples/?pos=chr17:7,514,241-7,514,331')
    @hide('#stats')
    def small_letters_mismatch(self, driver):
        wait_for_pileup(driver)

    @url('/examples/?pos=chr17:7,514,181-7,514,411')
    @hide('#stats')
    def blocks_mismatch(self, driver):
        wait_for_pileup(driver)

    @url('/examples/?pos=chr17:7,511,774-7,514,654')
    @hide('#stats')
    def gene_utf(self, driver):
        wait_for_pileup(driver)

    @url('/examples/?pos=chr17:7,513,279-7,513,459')
    @hide('#stats')
    def deletions(self, driver):
        wait_for_pileup(driver)

    @url('/examples/?pos=chr17:7,514,550-7,514,640')
    @hide('#stats')
    def inserts(self, driver):
        wait_for_pileup(driver)

    @url('/examples/?pos=chr17:7,514,000-7,515,000')
    @hide('#stats')
    def wide(self, driver):
        wait_for_pileup(driver)

