#!/usr/bin/env perl6

# header {{{1
v6;

use File::Temp;
use Terminal::ANSIColor;

print "Content-type: text/plain\n";
print "Access-Control-Allow-Origin: *\n";
#}}}

# query args {{{1
my $query = %*ENV<QUERY_STRING>.split('=')[1];
#}}}

my ($stderr, $stderr-fh) = tempfile(:prefix('samtools-idxstats-stderr-'), :unlink);

my $command = qq{samtools idxstats '$query'};

my $basename = IO::Path.new($*PROGRAM-NAME).basename;
my $path = $*PROGRAM-NAME.substr(0, $*PROGRAM-NAME.index($basename));
print $*ERR: color('blue');
print $*ERR: $path;
print $*ERR: color('bold blue');
print $*ERR: $basename;
print $*ERR: color('reset');
print $*ERR: ": ";
print $*ERR: color('green');
print $*ERR: $command;
print $*ERR: color('reset');
print $*ERR: "\n";

my $result = chomp qq:x{$command 2> $stderr};

my $err = False;
my $message = '';
for $stderr-fh.lines -> $line {
  $err = True;
  $message ~= "\n" ~ $line;
}

if ($err) {
  say "Status: 201 Backend Error\n";
  say 'Error getting bam index size with samtools';
  print $message;

  print $*ERR: color('yellow');
  say $*ERR: 'Error getting bam index size with samtools';
  print $*ERR: $message;
  print $*ERR: color('reset');
  print $*ERR: "\n";
}
else {
  say ''; # finish the HTTP header
  print $result;
}

unlink $stderr;
