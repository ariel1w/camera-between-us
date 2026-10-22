#!/bin/sh
# measures every voice clip (integrated loudness and true peak) for js/vogain.js
cd "$(dirname "$0")/../audio/vo" && for f in N/*.mp3 L/*.mp3; do
  ffmpeg -nostats -i "$f" -af ebur128=peak=true -f null - 2>&1 | awk -v f="$f" '/I:/{i=$2} /Peak:/{p=$2} END{print f, i, p}'
done
