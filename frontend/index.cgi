#!/usr/bin/env perl6

# header {{{1
v6;

use URI::Encode;
use Template::Mustache;
use Terminal::ANSIColor;
use Data::Dump;

my $basename = IO::Path.new($*PROGRAM-NAME).basename;
my $path = $*PROGRAM-NAME.substr(0, $*PROGRAM-NAME.index($basename));

sub log_message ($message) {
  print $*ERR: color('blue');
  print $*ERR: $path;
  print $*ERR: color('bold blue');
  print $*ERR: $basename;
  print $*ERR: color('reset');
  print $*ERR: ": ";
  print $*ERR: color('green');
  print $*ERR: $message;
  print $*ERR: color('reset');
  print $*ERR: "\n";
}

log_message('start');

print "Content-type: text/html\n";
print "Access-Control-Allow-Origin: *\n\n";
#}}}

my $template_engine = Template::Mustache.new(:from<.>, :extension<.mustache>);

# query args {{{1
my %arg;

sub usage {
  my $path = %*ENV<_> ?? %*ENV<_> !! '<pileup-script-uri>';
  if (%*ENV<SCRIPT_NAME>) {
    $path = "%*ENV<HTTP_HOST>%*ENV<SCRIPT_NAME>";
    $path ~~ s% '/index.cgi' $ %%;
  }
  say $template_engine.render('usage.html', {
    base_url => $path,
    server => %*ENV<HTTP_HOST>
  });

  if (%arg) {
    say "query parameters: {%arg.perl}";
  }
  log_message('rendered usage page');
  exit;
}

if (%*ENV<QUERY_STRING>) {
  my $q = uri_decode(%*ENV<QUERY_STRING>);
  for $q.split(/<[&;]>/) {
    my ($k, $v) = .split('=');
    if ($v) {
      %arg{$k} = $v;
    }
    else {
      %arg{$k} = True;
    }
  }
  say $*ERR: Dump(%arg);

  if (not %arg<coords> or not %arg<bam>) {
    usage();
  }
}
else {
  usage();
}

#}}}

sub get_url {
  my $url = 'http';
  if (%*ENV<HTTPS> and %*ENV<HTTPS> eq 'on') {
    $url ~= "s";
  }
  $url ~= '://';
  $url ~= %*ENV<HTTP_HOST> ~ %*ENV<REQUEST_URI>;
  return $url;
}

my $coords = %arg<coords>;
if (not $coords) {
  say 'missing coordinates';
  exit;
}

my $mark = %arg<mark>;

if ($coords ~~ /^ <-[:]>+ ':' (<-[-]>+) $/ and not $mark) {
  $mark = $0;
}

my $downsample = '';
if (%arg<downsample>) {
  $downsample = "downssample=%arg<downsample>;";
}

my $app = 'xo';
if (%arg<exome>) {
  $app = 'exome';
}

my $filter = '';
if (%arg<filter>) {
  $filter = "filter=%arg<filter>;";
}

my $select = '';
if (%arg<select>) {
  $select = %arg<select>;
}

my ($contig, $range) = $coords.split(':');
my ($start, $stop);
if ($range ~~ /'-'/) {
  ($start, $stop) = $range.split('-');
}
else {
  ($start, $stop) = ($range - 20, $range + 20);
}

my %template_data =
  url => get_url(),
  app => $app,
  downsample => $downsample,
  filter => $filter,
  select => $select,
  coords => $coords,
  contig => $contig,
  start => $start,
  stop => $stop,
  bam => %arg<bam>
  ;

if ($mark) {
  %template_data<mark> = $mark;
}
else {
  %template_data<mark> = False;
}

my $blacklist = %arg<blacklist>;
if ($blacklist) {
  %template_data<blacklist> = {
    url => $blacklist;
  };
}

log_message('rendering');
say $template_engine.render('index.html', %template_data);
log_message('done');

