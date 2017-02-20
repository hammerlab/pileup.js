function flowgram_panel () {

  function complement (base) {
    var tr = {A: 'T', C: 'G', G: 'C', T: 'A', a: 't', c: 'g', g: 'c', t: 'a', '-': '-'};
    return tr[base];
  }

  function flow_position (data, ref_offset) {
    var read_offset = data.read_index[ref_offset];
    if (data.read.isReverse()) {
      return data.flowgram_index[data.prefix.length + (data.aligned_seq.length - read_offset - 1)];
    }
    return data.flowgram_index[data.prefix.length + read_offset];
  }

  function load_flowgram(url, data) {
    return new Promise(function(resolve, reject) {
      var request = new XMLHttpRequest();
      request.open('POST', url, true);
      request.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
      request.responseType = 'text';

      // When the request loads, check whether it was successful
      request.onload = function() {
        if (request.status === 200) {
          resolve(request.response);
        }
        else {
          reject(Error('Flowgram data didn\'t load; error code:' + request.statusText));
        }
      };

      request.onerror = function() {
        // Also deal with the case when the entire request fails to begin with
        // This is probably a network error, so reject the promise with an appropriate message
        reject(Error('There was a network error.'));
      };

      // Send the request
      request.send(JSON.stringify(data));
    });
  }


  function render_flowgram(flowgram_div, read, midpoint, click_x) {
    // Fetch referenece bases for this read, including the soft-clipped regions
    var aligned_seq = read.seq;
    var contig = read.getInterval().contig;
    var interval = read.getInterval().interval;
    var sc_left = read.cigarOps[0].op === 'S' ? read.cigarOps[0].length : 0;
    var sc_right = read.cigarOps[read.cigarOps.length - 1].op === 'S' ? read.cigarOps[read.cigarOps.length - 1].length : 0;
    var target_range;
    for (var i in sources) {
      if (sources[i].isReference) {
        var target_range = sources[i].data.getRangeAsString({
          contig: contig,
          start: interval.start - sc_left,
          stop: interval.stop + sc_right
        });
      }
    }


    // Call the function with the URL we want to load, but then chain the
    // promise then() method on to the end of it. This contains two callbacks
    load_flowgram (
      '/flowgram.cgi',
      {
        bam: g_pileup_gui.bam,
        flag: read.flag,
        MD: read['MD:Z'],
        RG: read['RG:Z'],
        ZA: read['ZA:i'],
        ZC: read['ZC:B:i'],
        ZT: read['ZT:Z'],
        YT: read['YT:Z'],
        cigarOps: read.cigarOps.map(function(el) {return {Type: el.op, Length: el.length}}),
        seq: aligned_seq,
        ref: target_range,
        signal: read['ZM:B:s'],
        phase: read['ZP:B:f']
      }
    )
    .then (function (response) {
      if (!response.match(/<body.+color/)) {
        // This function runs when the promise resolves, with
        // request.reponse specified within the resolve() method.
        var data = JSON.parse(response);
        data.read = read;
        data.aligned_seq = aligned_seq;

        // Add index objects to data to map positions between different sequence representations
        var map = function () {
          // Map reference positions to read positions
          data.read_index = {};
          data.alignment_index = {}; // same as read_index but without soft clips
          var i_ref = 0;
          var i_read = 0;
          var i_aln = 0;
          var i;
          for (var c in read.cigarOps) {
            var chunk = read.cigarOps[c];
            if (chunk.op === 'M') {
              for (i = 0; i < chunk.length; i++) {
                data.read_index[i_ref + i] = i_read + i;
                data.alignment_index[i_ref + i] = i_aln + i;
              }
              i_ref += chunk.length;
              i_read += chunk.length;
              i_aln += chunk.length;
            }
            if (chunk.op === 'S') {
              i_read += chunk.length;
            }
            if (chunk.op === 'I') {
              i_read += chunk.length;
              i_aln += chunk.length;
            }
            if (chunk.op === 'D') {
              for (i = 0; i < chunk.length; i++) {
                data.read_index[i_ref + i] = i_read;
                data.alignment_index[i_ref + i] = i_aln;
              }
              i_ref += chunk.length;
            }
          }

          // Use the flowgram to map alignment positions to flows
          if (data.base_call) { // Torrent data
            var
            bi = 0,
            fi = 0;
            console.log(data);
            data.flowgram_index = {};
            for (fi = 0; fi < data.base_call.length; fi++) {
              for (var h = 0; h < data.base_call[fi]; h++) {
                data.flowgram_index[bi++] = fi;
              }
            }
          }

          return {
            map: function () {
            }
          };
        };
        map();


        // Render alignment.
        var insertion = {}; // if alignment.render() is called on the reference first, this will mark insertions
        var alignment = (function () {
          var render = function(pretty_seq, padding_seq, char_class, base_node_list) {
            var char;
            var i;
            var index = 0;

            // clean up the old sequence
            while (base_node_list.hasChildNodes()) {
              base_node_list.removeChild(base_node_list.lastChild);
            }

            // ------------------------------ reverse ------------------------------
            if (read.isReverse()) {
              for (i = 0; i < sc_right; i++) {
                char = complement(padding_seq[padding_seq.length - sc_right + i]);
                base_node_list.insertAdjacentHTML('beforeend', '<span id="' + char_class + '-' + index + '" class="' + char_class + ' ' + char.toUpperCase() + ' softclipped-char">' + char + '</span>');
                index += 1;
              }
              for (i = pretty_seq.length - 1; i >= 0; i--) {
                char = complement(pretty_seq[i]);
                if (char === '-') {
                  base_node_list.insertAdjacentHTML('beforeend', '<span class="sequence-gap">-</span>');
                  insertion[pretty_seq.length - i - 1] = true;
                }
                else {
                  base_node_list.insertAdjacentHTML('beforeend', '<span id="' + char_class + '-' + index + '" class="' + char_class + ' ' + char.toUpperCase() + '">' + char + '</span>');
                  index += 1;
                }
              }
              for (i = 0; i < sc_left; i++) {
                char = complement(padding_seq[i]);
                base_node_list.insertAdjacentHTML('beforeend', '<span id="' + char_class + '-' + index + '" class="' + char_class + ' ' + char.toUpperCase() + ' softclipped-char">' + char + '</span>');
                index += 1;
              }
            }

            // ------------------------------ forward ------------------------------
            else {
              for (i = 0; i < sc_left; i++) {
                char = padding_seq[i];
                base_node_list.insertAdjacentHTML('beforeend', '<span id="' + char_class + '-' + index + '" class="' + char_class + ' ' + char.toUpperCase() + ' softclipped-char">' + char + '</span>');
                index += 1;
              }
              for (i = 0; i < pretty_seq.length; i++) {
                char = pretty_seq[i];
                if (char === '-') {
                  base_node_list.insertAdjacentHTML('beforeend', '<span class="sequence-gap">-</span>');
                  insertion[i] = true;
                }
                else {
                  base_node_list.insertAdjacentHTML('beforeend', '<span id="' + char_class + '-' + index + '" class="' + char_class + ' ' + char.toUpperCase() + '">' + char + '</span>');
                  index += 1;
                }
              }
              for (i = 0; i < sc_right; i++) {
                char = padding_seq[padding_seq.length - sc_right + i];
                base_node_list.insertAdjacentHTML('beforeend', '<span id="' + char_class + '-' + index + '" class="' + char_class + ' ' + char.toUpperCase() + ' softclipped-char">' + char + '</span>');
                index += 1;
              }
            }
          };

          return {
            render: render
          };
        }());

        // Reference sequence
        alignment.render(data.pretty_tseq, target_range, 'ref-char', document.getElementById('read-alignment-ref'));

        // Query sequence
        alignment.render(data.pretty_qseq, aligned_seq, 'query-char', document.getElementById('read-alignment-query'));

        // Add mousemove listener to sequence display
        var alignment_node = document.getElementById('read-alignment');
        alignment_node.onmousemove = function (e) {
          var match, offset, exclude;
          if (e.target && e.target.nodeName === 'SPAN') {
            if (match = e.target.id.match(/^(ref|query)-char-(\d+)$/)) {
              if (match[1] === 'ref') {
                offset = parseInt(match[2], 10) - sc_right;
                g_pileup_gui.refToCursors(read.pos + offset);
              }
              if (match[1] === 'query') {
                // need a read-to-ref mapping done to move cursors according to read position
              }
            }
          }
        }


        // Render flowgram
        if (data.signal) {
        var flowgram = function () {
          var bar_width = 8;
          var frame_center_mark;
          var top_pointer, bottom_pointer;
          var x, y // graph scales
          var ref_node_list = document.getElementsByClassName('ref-char');
          var query_node_list = document.getElementsByClassName('query-char');
          var highlighted_ref_node;
          var highlighted_query_node;

          var render = function () {
            // Plot the signal
            //
            // ------------------------------ set up the graph ---------------------------------
            var signal = data.signal.map(function (s) { return parseInt(s, 10) / 256.0; });
            var min = d3.min([d3.min(data.ideal_flowgram), d3.min(data.reference_pred), d3.min(data.solution_pred), d3.min(signal)]);
            var max = d3.max([d3.max(data.ideal_flowgram), d3.max(data.reference_pred), d3.max(data.solution_pred), d3.max(signal)]);

            var
              margin = {top: 20, right: 20, bottom: 40, left: 20},
              width = (bar_width + 1) * data.signal.length;
              plot_width = width + margin.left + margin.right,
              height = 150 - margin.top - margin.bottom;


            x = d3.scale.ordinal().domain(d3.range(signal.length)).rangePoints([0, width], 1);
            y = d3.scale.linear().domain([min, max]).range([0, height]);

            // Create the main diagram
            var flowgram_svg = d3.select(flowgram_div)
              .append('svg:svg')
                .attr('width', plot_width)
                .attr('height', height + margin.top + margin.bottom);

            // Create pointer and mark defs
            var flowgram_def = flowgram_svg.append('defs');

            flowgram_def.append('g')
              .attr('id', 'pointer-top')
              .attr('transform', 'scale(0.13) rotate(180)')
              .style('opacity', 0.6)
              .append('path')
                .attr('d', 'm -50,90 100,0 c -27,-12 -44,-35 -50,-60 -8,26 -22,48 -50,60 z');

            flowgram_def.append('g')
              .attr('id', 'pointer-bottom')
              .attr('transform', 'scale(0.13)')
              .style('opacity', 0.6)
              .append('path')
                .attr('d', 'm -50,50 100,0 c -27,-12 -44,-35 -50,-60 -8,26 -22,48 -50,60 z');

            // Make a group for flowgram graph
            var flowgram_g = flowgram_svg.append('g')
               .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            // Make a group to pileup frame indicator
            var frame_g = flowgram_svg.append('g')
               .attr('transform', 'translate(' + margin.left + ', 0)');


            // ----------------------------- generate axis data --------------------------------
            //
            // Nucleotides in flow order
            var flowNucAxis = d3.svg.axis().scale(x).orient('bottom').tickFormat(function (d) {
              return data.flow_order[d]
            });

            // Flow ticks with each fifth marked by a number
            var flowNumberAxis = d3.svg.axis()
              .scale(x)
              .tickSize(6)
              .tickFormat(function (d, i) {
                if (i % 5) {
                  return '';
                }
                else {
                  return d;
                }
              });

            // Basecaller results
            var calledBasesAxis = d3.svg.axis()
              .scale(x)
              .orient('bottom')
              .tickFormat(function (d) {
                if (data.base_call[d]) {
                  return data.flow_order[d];
                }
                else {
                  return '';
                }
              });

            // Horizontal lines across the chart drawn at each HP unit
            var yAxisLeft = d3.svg.axis()
              .orient('left')
              .tickValues(d3.range(Math.ceil(max + 1)).map(function (v) { return height - y(v); }))
              .tickFormat(function (o, i) { // to use i instead of o
                return i;
              })
              .innerTickSize(-width)
              .outerTickSize(0)
              .tickPadding(5); // space between the axis and labels

            var yAxisRight = d3.svg.axis()
              .orient('right')
              .tickValues(d3.range(Math.ceil(max + 1)).map(function (v) { return height - y(v); }))
              .tickFormat(function (o, i) {
                return i;
              })
              .innerTickSize(0)
              .outerTickSize(0)
              .tickPadding(5);


            // --------------------------------- render axes -----------------------------------
            //
            // Flow nucleotides
            flowgram_g.append('g')
              .attr('class', 'x axis')
              .attr('transform', 'translate(0,' + (height - 6) + ')')
              .call(flowNucAxis)
              .selectAll('line').remove(); // there doesn't seem to be a better way to remove ticks

            // Called bases
            (function () {
              flowgram_g.append('g')
                .attr('class', 'x axis bases')
                .attr('transform', 'translate(0,' + (height + 4) + ')')
                .call(calledBasesAxis)
                .selectAll('line').remove();

              // Use nuc colors to paint existing labels for forward reads. Complement and
              // paint labels for reverse reads
              flowgram_g.selectAll('.bases text').each(function (flow) {
                var start = data.prefix_flows;
                if (data.base_call[data.prefix_flows - 1] > 1) {
                  start -= 1;
                }
                if (flow >= start && this.textContent !== '') {
                  this.style.fontWeight = 'bold';
                  if (read.isReverse()) {
                    this.textContent = complement(this.textContent);
                  }
                  this.setAttribute('class', this.textContent);
                }
              });
            } ());

            // Flow ticks with numbers
            var flow_axis = flowgram_g.append('g')
              .attr('id', 'flow-axis')
              .attr('class', 'x axis')
              .attr('transform', 'translate(0,' + (height + 22) + ')')
              .call(flowNumberAxis);

            // Signal levels in HP units
            flowgram_g.append('g')
              .attr('class', 'y axis')
              .call(yAxisLeft)

            flowgram_g.append('g')
              .attr('class', 'y axis')
              .attr('transform', 'translate(' + width + ' ,0)')
              .call(yAxisRight)


            // ------------------------------ plot the flowgram --------------------------------
            //
            // Signal bars
            var flowgramGroup = flowgram_g.selectAll('.bar')
              .data(signal)
              .enter()
              .append('g')
                .attr('transform', function(d, i) { return 'translate (' + (x(i) - bar_width / 2) + ', 0)'; });

            flowgramGroup.append('rect')
              .attr('class', function(d, i) { return 'bar ' + data.flow_order[i]; })
              .attr('x', 0)
              .attr('y', function(d) { if (d > 0) return height - y(d); else return height - y(0); })
              .attr('height', function(d) { if (d > 0) return y(d) - y(0); else return y(0) - y(d); })
              .attr('width', 8);

            // Reference prediction circles (empty)
            flowgramGroup.append('circle')
              //.attr('class', function(d, i) { var r = data.reference_pred[i]; if (r < 0.2) return 'remove'; else return 'reference-prediction'; })
              .attr('class', function(d, i) { return 'reference-prediction'; })
              .attr('stroke', 'black')
              .attr('stroke-opacity', 0.6)
              .attr('fill-opacity', 0)
              .attr('cx', bar_width / 2)
              .attr('cy', function(d, i) { var s = data.reference_pred[i]; return height - y(s); })
              .attr('r', 4);

            // Solution circles (solid)
            flowgramGroup.append('circle')
              //.attr('class', function(d, i) { var s = data.solution_pred[i]; if (s < 0.2) return 'remove'; else return 'solution-prediction'; })
              .attr('class', function(d, i) { return 'solution-prediction'; })
              .attr('fill', 'black')
              .attr('fill-opacity', 0.7)
              .attr('cx', bar_width / 2)
              .attr('cy', function(d, i) { var r = data.solution_pred[i]; return height - y(r); })
              .attr('r', 2);

            // Mechanistic reference simulation
//            flowgramGroup.append('path')
//              .attr('class', function(d, i) { var s = data.ideal_flowgram[i]; if (s < 0.2) return 'remove'; else return 'solution-prediction'; })
//              .attr('stroke', 'black')
//              .attr('stroke-opacity', 0.4)
//              .attr('fill-opacity', 0)
//              .attr('d', function(d, i) {
//                var s = data.ideal_flowgram[i];
//                return 'M -0.5,' + (height - y(s) - 1) + ' a ' + (bar_width / 2 + 0.5) + ',' + (bar_width / 2 + 0.5) + ' 0 0 1 ' + (bar_width + 1) + ',0';
//              })
//              .attr('stroke-width', 1.5);

            // Clean up unwanted circles
            removeElementsByClass('remove');

            // Mark large residuals by connecting dots and circles
            for (var i = 0; i < data.solution_pred.length; i += 1) {
              var s = data.solution_pred[i];
              var r = data.reference_pred[i];
              if (Math.abs(s - r) > 0.25) {
                flowgram_g.append('line').attr({
                  x1: x(i),
                  x2: x(i),
                  y1: height - y(r),
                  y2: height - y(s),
                  stroke: 'black',
                  'stroke-width': 1
                });
              }
            }

            // --------------------------------- highlights ------------------------------------
            //
            // Key sequence
            //
            // Draw two rectangles to highlight the last key sequence flow
            // avioding the called base co-inciding with it.
            flowgram_g.append('rect').attr({
              class: 'key_sequence',
              x: 0,
              y: height,
              width: x(data.prefix_flows) - bar_width / 2,
              height: 11
            });
            if (data.base_call[data.prefix_flows - 1] > 1) {
              flowgram_g.append('rect').attr({
                class: 'key_sequence',
                x: 0,
                y: height + 11,
                width: x(data.prefix_flows - 1) - bar_width / 2,
                height: 12
              });
            }
            else {
              // copy the top rectangle
              flowgram_g.append('rect').attr({
                class: 'key_sequence',
                x: 0,
                y: height + 11,
                width: x(data.prefix_flows) - bar_width / 2,
                height: 12
              });
            }

            // Pileup mark
            if (g_pileup_gui.mark) {
              var mark; // base coordinate
              // read.pos is 0-based; {mark} is 1-based
              if (read.isReverse()) {
                mark = (g_pileup_gui.mark - 1 - read.pos);
              }
              else {
                mark = g_pileup_gui.mark - 1 - read.pos;
              }
              if (mark === undefined) {
                mark = 0;
              }
              var top_mark = flowgram_g.append('use')
                .attr({
                  'xlink:href': '#pointer-top',
                })
                .style({
                  display: 'none',
                  fill: 'brown',
                  'fill-opacity': 1
                });
              var bottom_mark = flow_axis.append('use')
                .attr({
                  'xlink:href': '#pointer-bottom',
                })
                .style({
                  display: 'none',
                  fill: 'brown',
                  'fill-opacity': 1
                });
            }

            if (g_pileup_gui.mark >= interval.start && g_pileup_gui.mark <= interval.stop) {
              var flow = flow_position(data, mark);
              [top_mark, bottom_mark].forEach(function (node) {
                node.style('display', 'block');
                node.attr('transform', 'translate(' + x(flow) + ')');
              });
            }

            // Pileup center line
            frame_g.append('rect')
              .attr({
                id: 'frame-center-mark',
                x: 0, // will be set below if inside alignment
                y: 0,
                height: height + margin.top + margin.bottom,
                width: bar_width + 2
              })
              .style({
                display: 'none',
                'stroke-width': 1,
                stroke: 'navy',
                'stroke-opacity': 0.5,
                fill: 'navy',
                'fill-opacity': 0.02,
              });

            frame_center_mark = document.getElementById('frame-center-mark');
            if (midpoint >= interval.start && midpoint <= interval.stop) {
              flow = flow_position(data, midpoint - read.pos);
              frame_center_mark.setAttribute('x', x(flow) - bar_width / 2 - 1);
              d3.selectAll('#frame-center-mark').style('display', 'block');
            }

            // Cursors
            top_pointer = flowgram_g.append('use')
              .attr('xlink:href', '#pointer-top')
              .style({
                fill: 'black',
                'fill-opacity': 1
              });
            bottom_pointer = flow_axis.append('use')
              .attr('xlink:href', '#pointer-bottom')
              .style({
                fill: 'black',
                'fill-opacity': 1
              });
            flow = flow_position(data, click_x - read.pos);
            top_pointer.attr('transform', 'translate(' + x(flow) + ')');
            bottom_pointer.attr('transform', 'translate(' + x(flow) + ')');


            //// Create the navigator
            //var navWidth = width,
            //navHeight = 100 - margin.top - margin.bottom;

            //var navChart = d3.select(flowgram_div)
            //  .append('svg:svg')
            //  .classed('navigator', true)
            //  .attr('width', navWidth + margin.left + margin.right)
            //  .attr('height', navHeight + margin.top + margin.bottom)
            //  .append('g')
            //    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            //navYScale = d3.scale.linear()
            //  .domain([min, max])
            //  .range([navHeight, 0]);

            //var navXAxis = d3.svg.axis()
            //  .scale(x)
            //  .orient('bottom');

            //navChart.append('g')
            //  .attr('class', 'x axis')
            //  .attr('transform', 'translate(0,' + navHeight + ')')
            //  .call(navXAxis);
          };

          // Clicking on a read in the pileup takes us here
          var refToCursors = function (pos) { // pos is cursor position relative to contig start
            var ref_offset = pos - read.pos; // 0 at alignment start
            var read_offset = data.read_index[ref_offset]; // sc_left at alignment start
            var ref_cursor_pos = ref_offset;
            var read_cursor_pos = data.alignment_index[ref_offset];

            var interval = read.getInterval().interval; // mapped interval
            if (pos >= interval.start && pos <= interval.stop) {
              if (read.isReverse()) {
                ref_cursor_pos += sc_right;
                read_cursor_pos += sc_right;
              }
              else {
                ref_cursor_pos += sc_left;
                read_cursor_pos += sc_left;
              }

              // Higlight the reference
              if (highlighted_ref_node) {
                highlighted_ref_node.classList.remove('base-highlighted');
              }
              ref_node_list[ref_cursor_pos].classList.add('base-highlighted');
              highlighted_ref_node = ref_node_list[ref_cursor_pos];

              // Highlight query sequence
              if (highlighted_query_node) {
                highlighted_query_node.classList.remove('base-highlighted');
              }
              query_node_list[read_cursor_pos].classList.add('base-highlighted');
              highlighted_query_node = query_node_list[read_cursor_pos];

              // Move flowgram cursor
              var flow = flow_position(data, ref_offset);
              top_pointer.attr('transform', 'translate(' + x(flow) + ')');
              bottom_pointer.attr('transform', 'translate(' + x(flow) + ')');
            }
          };

          var queryToCursors = function (read_offset) {
            var ref_offset = data.query_to_ref[read_offset];

            // var read_offset = data.read_index[ref_offset]; // sc_left at alignment start
            // var ref_cursor_pos = ref_offset;
            // var read_cursor_pos = data.alignment_index[ref_offset];

            // if (read.isReverse()) {
            //   ref_cursor_pos += sc_right;
            //   read_cursor_pos += sc_right;
            // }
            // else {
            //   ref_cursor_pos += sc_left;
            //   read_cursor_pos += sc_left;
            // }

            // Higlight reference position
            if (highlighted_ref_node) {
              highlighted_ref_node.classList.remove('base-highlighted');
            }
            ref_node_list[ref_offset].classList.add('base-highlighted');
            highlighted_ref_node = ref_node_list[ref_offset];

            // Highlight query sequence
            if (highlighted_query_node) {
              highlighted_query_node.classList.remove('base-highlighted');
            }
            query_node_list[read_offset].classList.add('base-highlighted');
            highlighted_query_node = query_node_list[read_offset];

            // // Move flowgram cursor
            // var flow = flow_position(data, ref_offset);
            // top_pointer.attr('transform', 'translate(' + x(flow) + ')');
            // bottom_pointer.attr('transform', 'translate(' + x(flow) + ')');
          };

          var updateFrame = function (pos) { // pos is cursor position relative to contig start
            var ref_offset = pos - read.pos; // 0 at alignment start
            console.log('updateFrame: frame center', ref_offset);
            var flow = flow_position(data, ref_offset);
            if (pos >= interval.start && pos <= interval.stop) {
              frame_center_mark.setAttribute('x', x(flow) - bar_width / 2 - 1);
              d3.selectAll('#frame-center-mark').style('display', 'block');
            }
            else {
              d3.selectAll('#frame-center-mark').style('display', 'none');
            }
          };

          return {
            render: render,
            refToCursors: refToCursors,
            queryToCursors: queryToCursors,
            updateFrame: updateFrame
          }
        }; // flowgram()

        g_pileup_gui.flowgram = flowgram();
        g_pileup_gui.flowgram.render();
        g_pileup_gui.refToCursors(click_x);
        } // data.signal exists (Torrent)

      } // Valid response

      else {
        // render the error message
        console.log('error in flowgram.cgi');
        var iframe = document.createElement('iframe');
        iframe.frameBorder=0;
        iframe.width='600px';
        iframe.height='600px';
        iframe.id='server-error-frame';
        iframe.src = 'data:text/html;charset=utf-8,' + response;
        document.getElementById('flowgram-basecaller').appendChild(iframe);
      }
    }, // function (response)

    function (error) {
      // This runs when the promise is rejected
      // console.log(error);
      alert(error);
    }); // load_flowgram().then(function(response), function(error))
  } // render_flowgram()

  function removeElementsByClass (className) {
    var nodes = document.getElementsByClassName(className);
    while(nodes.length > 0) {
      nodes[0].parentNode.removeChild(nodes[0]);
    }
  }

  // Reads from the pileup are only partially parsed; parse everything know
  function parseReadData (sam_read) {
    var
      i,
      f = sam_read.buffer.split('\t'),
      read = {
        name: sam_read.name,
        flag: sam_read.flag,
        length: sam_read.l_seq,
        pos: sam_read.pos - 1,
        cigar: sam_read.cigarString,
        cigarOps: sam_read.cigarOps,
        mapq: parseInt(f[4], 10),
        seq: sam_read._seq,
        qual: sam_read._qual.replace(/</g, '=').replace(/>/g, '='),
        ref: sam_read.ref,
        refID: sam_read.refID,
        samOrder: ['name', 'flag', 'ref', 'pos', 'mapq', 'cigar', 'length', 'seq', 'qual'],
        isReverse: sam_read.isReverse,
        getInterval: sam_read.getInterval,
        getReferenceLength: sam_read.getReferenceLength,
      };

    console.log(sam_read._qual);
    for (i = 11; i < f.length; i++) {
      var
        subtag = f[i].split(':'),
        data = subtag.pop(),
        type = null;

      data = data.replace(/^([fis]),/, function (match, c) {
        type = c;
        subtag.push(c);
        return '';
      });

      tag = subtag.join(':');
      read.samOrder.push(tag);
      if (type) {
        if (type === 'f') {
          read[tag] = data.split(',').map(function (v) { return parseFloat(v); });
        }
        else { // type === i or s
          read[tag] = data.split(',').map(function (v) { return parseInt(v, 10); });
        }
      }
      else {
        if (tag.match(/:i$/)) {
          read[tag] = parseInt(data, 10);
        }
        else {
          read[tag] = data;
        }
      }
    }

    if (read['YT:Z'] && (read['ZA:i'] - read.length - read['YT:Z'].length > 0)) {
      read.qt = true;
    }

    return read;
  }

  function formatReadData (read) {
    var buf;

    buf = '<table>';
    buf += '<tr><td class="read-data-tag">Flag</td><td class="read-data-value">' + read.flag + '</td></tr>';
    buf += '<tr><td class="read-data-tag">Length</td><td class="read-data-value">' + read.seq.length + '</td></tr>';
    buf += '<tr><td class="read-data-tag">MAPQ</td><td class="read-data-value">' + read.mapq + '</td></tr>';
    buf += '<tr><td class="read-data-tag">Sequence</td><td class="read-data-value">' + read.seq + '</td></tr>';
    buf += '<tr><td class="read-data-tag">Quality</td><td class="read-data-value">' + read.qual + '</td></tr>';

    read.samOrder.forEach(function(key) {
      var value = read[key];
      if (key === 'seq') return;
      if (key === 'qual') return;

      buf += '<tr><td class="read-data-tag">' + key + '</td><td class="read-data-value">' + value + '</td></tr>';
    });

    buf += '</table>';

    return buf;
  }

  pileup.readDataPanel = document.getElementById('read-data-split');

  pileup.readDataPanel.open = function (read_data, midpoint, mouse_pos) {
    var read = parseReadData(read_data);
    var trimmed = read.qt ? ' Q-trimmed' : '';
    document.getElementById('read-data-title').innerHTML = read.name + ' ' + read.getInterval() + ' ' + read.cigar + trimmed;
    document.getElementById('read-data').innerHTML = formatReadData(read);
    if (document.getElementById('flowgram-basecaller')) {
      document.getElementById('flowgram-basecaller').remove();
    }
    document.getElementById('split-panel-content').insertAdjacentHTML('beforeend', '<div id="flowgram-basecaller" />');
    pileup.readDataPanel.style.display = 'block';

    // Unsplit
    removeElementsByClass('gutter');

    // Retrieve the split ratio from storage
    var popup_size = parseInt(localStorage.getItem('popup_size'), 10) || 50;
    var pileup_size = 100 - popup_size;

    Split(['#pileup', '#read-data-split'], {
      direction: 'vertical',
      sizes: [pileup_size, popup_size],
      minSize: 300
    });

    pileup.readDataPanel.state = 'open';

    render_flowgram('#flowgram-basecaller', read, midpoint, mouse_pos);
  }

  pileup.readDataPanel.close = function() {
    pileup.readDataPanel.style.display = 'none';

    // Unsplit
    removeElementsByClass('gutter');

    Split(['#pileup', '#read-data-split'], {
      direction: 'vertical',
      sizes: [100, 0],
      minSize: 0
    });

    pileup.readDataPanel.state = 'closed';
    g_pileup_gui.flowgram = null;
  }

  // Close the flowgram by clicking on the cross
  document.getElementById('read-data-split-close').onclick = function() {
    pileup.readDataPanel.close();
  }

  // Close by pressing the Esc key
  window.onkeydown = function(e) {
    if (pileup.readDataPanel.state === 'open' && e.keyCode === 27) {
      pileup.readDataPanel.close();
    }
  };
}
