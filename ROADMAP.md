# Roadmap for future work

A few ideas:

* Support "wiggle" tracks & visualizations.
* UI polish: make double-click zoom in and improve the pop-up UI when you click a read.
* Split the data-loading and parsing code out into a separate library. It
  should be valuable for anyone working with genome data either in the browser
  or with node.js. This should use the `.js.flow` convention introduced in [Flow 0.19][1].
* Drive adoption by getting listed on a site like DNANexus.
* Look into web workers. This could speed both data parsing and rendering by
  letting them run off the browser's main UI thread.
* API polish: be more consistent about using `ContigInterval` or `GenomeRange`
  throughout the project (and 0-based vs. 1-based coordinates).
* Add a way to type "TP53" in the location box and jump to that gene.

[1]: https://github.com/facebook/flow/releases/tag/v0.19.0
