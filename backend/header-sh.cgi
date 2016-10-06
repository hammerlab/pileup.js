#!/bin/bash

echo "Content-type: text/plain"
echo "Access-Control-Allow-Origin: *"
echo ""

# Save the old internal field separator.
OIFS="$IFS"

# Set the field separator to ; and parse the QUERY_STRING at the ampersand.
IFS="${IFS};"
set $QUERY_STRING
Args="$*"
IFS="$OIFS"

# Next parse the individual "name=value" tokens.
COORDS=""
BAM=""

for i in $Args ;do
  # Set the field separator to =
  IFS="${OIFS}="
  set $i
  IFS="${OIFS}"

  case $1 in
    # Don't allow "/" changed to " ". Prevent hacker problems.
    coords) COORDS="`echo $2 | sed 's/chr//' | sed 's|[\]||g' | sed 's|%20| |g'`"
      ;;
    # Filter for "/" not applied here
    bam) BAM="`echo $2 | sed 's|%20| |g'`"
      ;;
    *)  echo "Unrecognized argument \'$1\'"
      ;;

  esac
done

(>&2 echo samtools view -H $BAM)
samtools view -H $BAM
