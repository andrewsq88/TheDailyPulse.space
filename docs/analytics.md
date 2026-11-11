# Cookieless analytics

This site uses a first-party, cookieless pageview beacon. It records path,
referrer, viewport, and time, and does not set cookies or a lasting identifier.

GoatCounter is an optional hosted destination. It is donation-supported and
free for reasonable public use, including small-to-medium businesses, with no
card required to open an account. Automated registration is not allowed, so a
human must create the site and then add a `goatcounter-code` meta tag with
the site code. Until that tag is present, only the first-party beacon runs.

Do not use a Netlify Function as the collect endpoint: that would consume
Netlify credits on every pageview.
