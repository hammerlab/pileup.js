#!/usr/bin/env perl6

# header {{{1
v6;

use File::Temp;

print "Content-type: text/plain\n";
print "Access-Control-Allow-Origin: *\n\n";
#}}}

# query args {{{1
my %arg;
for %*ENV<QUERY_STRING>.split(/<[&;]>/) {
  my ($k, $v) = .split('=');
  %arg{$k} = $v;
}
#}}}

my ($stderr, $stderr-fh) = tempfile(:prefix('samtools-mpileup-stderr-'), :!unlink);

my $command = qq{grep "%arg<chrom>\t%arg<pos>" "%arg<file>"};

say $*ERR: "$*PROGRAM-NAME: $command";
my $result = chomp qq:x{$command 2> $stderr};

my $err = False;
my $message = '';
if ($err) {
  say "Status: 201 Backend Error\n";
  say 'Error in samtools';
  print $message;
}
else {
  say '';
  print $result;
}

unlink $stderr;
