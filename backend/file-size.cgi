#!/usr/bin/env perl6

# header {{{1
v6;

use File::Temp;
#}}}

my ($stderr, $stderr-fh) = tempfile(:prefix('wc-stderr-'), :unlink);

my $query = %*ENV<QUERY_STRING>.split('=')[1];
my $command = qq{wc -c $query};
say $*ERR: "$*PROGRAM-NAME: $command";
my $result = chomp qq:x{$command 2> $stderr};

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
  say 'Error getting file size with wc';
  print $message;
}
else {
  say '';
  print $result;
}
