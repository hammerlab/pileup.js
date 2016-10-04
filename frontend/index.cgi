#!/usr/bin/env perl6

say $*ERR: 'pileup.cgi start';

# header {{{1
v6;

use URI::Encode;
use Template::Mustache;
use Data::Dump;
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
  print "Content-type: text/html\n\n";
  say $template_engine.render('usage.html', {
    base_url => $path,
    server => %*ENV<HTTP_HOST>
  });

  if (%arg) {
    say "query parameters: {%arg.perl}";
  }
  say $*ERR: 'pileup/index.cgi usage done';
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
  say $*ERR: "pileup/index.cgi args: {%arg.perl}";
  if (not %arg<coords> and not %arg<bam>) {
    usage();
  }
}
else {
  usage();
}

#}}}

sub get_url {
  say $*ERR: Dump(%*ENV);
  my $url = 'http';
  if (%*ENV<HTTPS> and %*ENV<HTTPS> eq 'on') {
    $url ~= "s";
  }
  $url ~= '://';
  $url ~= %*ENV<HTTP_HOST> ~ %*ENV<REQUEST_URI>;
  return $url;
}

print "Content-type: text/html\n\n";

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
  ($start, $stop) = ($range - 10, $range + 10);
}

my %template_data =
  url => get_url(),
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

say $*ERR: "pileup/index.cgi rendering";
say $template_engine.render('index.html', %template_data);

say $*ERR: "pileup/index.cgi done";

