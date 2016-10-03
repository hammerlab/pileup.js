#!/usr/bin/env perl6

# header {{{1
v6;

use File::Temp;
say $*ERR: "$*PROGRAM-NAME: start";
#}}}


# query args {{{1
my %arg;
for %*ENV<QUERY_STRING>.split(/<[&;]>/) {
  my ($k, $v) = .split('=');
  if ($v) {
    %arg{$k} = $v;
  }
  else {
    %arg{$k} = True;
  }

  # This should be an option
  %arg<coords> ~~ s/chr//;
}
#}}}

my ($stderr, $stderr-fh) = tempfile(:prefix('samtools-view-stderr-'), :unlink);

my $downsample = '';
if (%arg<downssample>) {
  $downsample = " -s %arg<downssample>";
}

my $command;
my $subcommand_alt = '';
if (%arg<alt>) {
  $subcommand_alt = '| ./select-mismatches';
}

if (%arg<filter>) {
  $command = qq{samtools view $downsample %arg<bam> %arg<coords> $subcommand_alt | egrep -i '%arg<filter>'};
}
else {
  $command = qq{samtools view $downsample %arg<bam> %arg<coords> $subcommand_alt};
}
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
  say 'Error in samtools';
  print $message;
}
else {
  say '';
  print $result;
}

say $*ERR: "$*PROGRAM-NAME: done";
