#!/usr/bin/env perl6

# header {{{1
v6;

use File::Temp;
#}}}

# query args {{{1
my %arg;
for %*ENV<QUERY_STRING>.split(/<[&;]>/) {
  my ($k, $v) = .split('=');
  %arg{$k} = $v;
}
#}}}

my ($stderr, $stderr-fh) = tempfile(:prefix('samtools-mpileup-stderr-'), :!unlink);

print "Content-type: text/plain\n";
print "Access-Control-Allow-Origin: *\n\n";

my $command = qq{samtools faidx /home/selkov/data/reference/Homo_sapiens.GRCh37.75.dna.primary_assembly.fa %arg<coords> | tail -1};

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
