#!/usr/bin/env perl6

# header {{{1
v6;

use File::Temp;
use Terminal::ANSIColor;

print "Content-type: text/plain\n";
print "Access-Control-Allow-Origin: *\n";
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

my $subcommand_alt = '';
if (%arg<alt>) {
  $subcommand_alt = '| ./select-mismatches';
}

my $command;
if (%arg<filter>) {
  $command = qq{samtools view $downsample %arg<bam> %arg<coords> $subcommand_alt 2> $stderr | egrep -i '%arg<filter>'};
}
else {
  $command = qq{samtools view $downsample %arg<bam> %arg<coords> $subcommand_alt 2> $stderr};
}

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

my $result = chomp qq:x{$command};

my $err = False;
my $message = '';
for $stderr-fh.lines -> $line {
  $err = True;
  $message ~= "\n" ~ $line;
}

if ($err) {
  say "Status: 201 Backend Error\n";
  say 'Error in samtools';
  print $message;

  print $*ERR: color('yellow');
  print $*ERR: $message;
  print $*ERR: color('reset');
  print $*ERR: "\n";
}
else {
  say ''; # finish the HTTP header
  print $result;
  if ($message) {
    print $*ERR: color('yellow');
    print $*ERR: $message;
    print $*ERR: color('reset');
    print $*ERR: "\n";
  }
}

unlink $stderr;
