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
  %arg{$k} = $v;
}
#}}}

my ($stderr, $stderr-fh) = tempfile(:prefix('samtools-mpileup-stderr-'), :!unlink);

my $command = qq{samtools mpileup -d2000 -r %arg<coords> -f %arg<ref> %arg<bam> 2> $stderr | cut -f3-5};

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
  # Mpileup writes neutral information to stderr and it fails to set max depth from -d
  if (not $line ~~ /\d+ ' samples in ' \d+ ' input'/ and not $line ~~ /'Set max per' '-' 'file depth'/) {
    $err = True;
  }
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
