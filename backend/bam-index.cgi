#!/usr/bin/env perl6

# header {{{1
v6;

use File::Temp;
say $*ERR: "bam-index.cgi start";
#}}}

my ($stderr, $stderr-fh) = tempfile(:prefix('wc-stderr-'), :unlink);

my $query = %*ENV<QUERY_STRING>.split('=')[1];
my $result = chomp qq:x{samtools idxstats $query 2> $stderr};

my $err = False;
my $message = '';
for $stderr-fh.lines -> $line {
  $err = True;
  $message ~= "\n" ~ $line;
}

say 'Content-type: text/plain';
say 'Access-Control-Allow-Origin: *';

if ($err) {
  say "Status: 201 Backend Error\n";
  say 'Error getting bam index size with samtools';
  print $message;
}
else {
  say '';
  print $result;
}

say $*ERR: "bam-index.cgi done";
