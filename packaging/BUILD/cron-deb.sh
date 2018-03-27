#!/bin/sh
#
# Copyright (c) 2009 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.
#
# This script is part of the google-chrome package and was modified to work with
# Nimiq's repository.
#
# It creates the repository configuration file for package updates, and it
# monitors that config to see if it has been disabled by the overly aggressive
# distro upgrade process (e.g.  intrepid -> jaunty). When this situation is
# detected, the respository will be re-enabled. If the respository is disabled
# for any other reason, this won't re-enable it.
#
# This functionality can be controlled by creating the $DEFAULTS_FILE and
# setting "repo_add_once" and/or "repo_reenable_on_distupgrade" to "true" or
# "false" as desired. An empty $DEFAULTS_FILE is the same as setting both values
# to "false".

# System-wide package configuration.
DEFAULTS_FILE="/etc/default/nimiq"

# sources.list setting for nimiq updates. XXX update this when the official repo is ready
REPOCONFIG="deb [arch=amd64] https://test.nimiq.space/repo stable main"
REPOCONFIGREGEX="deb (\[arch=[^]]*\bamd64\b[^]]*\][[:space:]]*) https?://test.nimiq.space/repo stable main"

APT_GET="`which apt-get 2> /dev/null`"
APT_CONFIG="`which apt-config 2> /dev/null`"

SOURCES_PREAMBLE="### THIS FILE IS AUTOMATICALLY CONFIGURED ###
# You may comment out this entry, but any other modifications may be lost.\n"

# Install the repository/package signing keys, if they aren't already.
# (see also: XXX update this when the official repo is ready)
install_key() {
  APT_KEY="`which apt-key 2> /dev/null`"
  if [ ! -x "$APT_KEY" ]; then
    return
  fi

  NEED_KEYS=0

  # 2018 signing subkey XXX: update the key when the official one is ready
  "$APT_KEY" export 24C4AE2E552F62A223FCE972C4E3ED6A1F7126FE 2>&1 | \
    grep -q -- "-----BEGIN PGP PUBLIC KEY BLOCK-----"
  if [ $? -ne 0 ]; then
    NEED_KEYS=1
  fi

  if [ $NEED_KEYS -eq 1 ]; then
    "$APT_KEY" add - >/dev/null 2>&1 <<KEYDATA
-----BEGIN PGP PUBLIC KEY BLOCK-----

mQENBFqu95ABCADSveT8gm+UNNyQ+BOULxwaST53Hc8iMTN7zmq5ei6f1T5R6HHu
RLe06R4YJnQn0xP9pyrmfiFLQLUUKcAAgfwSdwHxeP4Ytg+T6Q7QxssWxtBZv0pN
3PdSWHgLKzGo56NNdXDeo6lvi+8RG+uaVGbc8M3ggait+93G7B2C8KCLhPp0LGMG
fQhkqCfpHfZBPSNOaGXQXdRijbOvkoD4Ktr9V99BSpDfhX76Qbtzzc0nQThGVjrq
13mG8Sy3Q1WDcaNX9sOi+GlYzNMASvBAEW2bKWTtbO3vozEoSgkqAE+ZOWkA1Xcl
o+bwQalxdm1vMceLqeYI7cd+5Eftt893DW7XABEBAAG0G05pbWlxIFRlYW0gPGlu
Zm9AbmltaXEuY29tPokBNwQTAQgAIQUCWq73kAIbAwULCQgHAgYVCAkKCwIEFgID
AQIeAQIXgAAKCRDE4+1qH3Em/u5EB/4sksjphH6TjKpOd+4c4msMbaA7QfAdD9Xn
wet24njE+eYwiaH6+Dg+rziGkewvZ6fTY9QbOWugqiZ98QD1e0Er7EM03iAbNZSr
mb+BGlx9CH5V3+zMIxfOOD3qTJXaEr89Jz9o9VkBLXGyy4SgvUsrrDDZJ/4G24dA
LXjpoU7TsSaTOpPEu8lkWoUyvzxdqqqslYErsRU6xXJrVpsarfFVtNQkWhNVdrNq
K5YvDs1AQ4gxJkIoJbPrBNhreVKPz37TVopGgbYHmSEkV6x4jAwpf8As5631wkkW
RZcsXNUw/650sseJBAMhCyLm+Hm7GbVlqJHZx4ZLdab5ALLt0rkquQENBFqu95AB
CACwZlLwG3NOclxcteiJX+qn0vDB8HoXvNs2rcJzL6+I5Peavkowy9T2+iI67TRC
miQOsCRXmKY2itFaylvapIMqakV0AmWwvig9+lgyhjHYaTMQHNkDej5CpZ2ixfc4
2aCZc+bbs9zYB/5YXGmIp2H4wV4fiorKLI8h2tgbudrUvr5ezNQFXAqxdafsuC2a
d2taPiBlal93zh43hO5k3dS/EX4QNJ16RVg8v+JPM5/YcXhqxMs+rkwfI/+sCgU9
rfWLedTPLzy6mEuBAMsQLZ76b4NBWhruRfao63XNftID5bgy8hZxejP2My+LcEkZ
QTfO+G214CIHH5onmOFLrgI5ABEBAAGJAR8EGAEIAAkFAlqu95ACGwwACgkQxOPt
ah9xJv5PlQgApCTLNoUSOLRFiBMuQ/rJvI5vg5XR8QBEPZ6nboxq6sJ3t9Uy4Mql
+eeo5jgxa5A15Ziy/3vVfCoH7sr7nUcwCcI+m9WbQ6qjQUotnjWMGJvaKjk0HqAF
VhKEVAYrIp7iG92AiBLWLnCCMNZDBqb6gULCZ/nrZHv14s+i3qRDWtn6J2t577YZ
/AqZJ+QZ4rYLvoBCJsncsEApPMckafpHWXgdQ4Nw3vQKSr4iS2Lm/SM7o4ak1/xL
605X8D1wDpD7auH3ZMnv+hLWdRss7zwM3i2V6CezsC7f+OuZGwZi7noCtaVp0sR3
hZeZpI6aEx0gB8we29ZOJz14IrjcgXDjSA==
=h1YC
-----END PGP PUBLIC KEY BLOCK-----
KEYDATA
  fi
}

# Set variables for the locations of the apt sources lists.
find_apt_sources() {
  eval $("$APT_CONFIG" shell APT_SOURCESDIR 'Dir::Etc::sourceparts/d')
}

# Update the Nimiq repository if it's not set correctly.
# Note: this doesn't necessarily enable the repository, it just makes sure the
# correct settings are available in the sources list.
# Returns:
# 0 - no update necessary
# 2 - error
update_bad_sources() {
  if [ ! "$REPOCONFIG" ]; then
    return 0
  fi

  find_apt_sources

  SOURCELIST="$APT_SOURCESDIR/nimiq.list"
  # Don't do anything if the file isn't there, since that probably means the
  # user disabled it.
  if [ ! -r "$SOURCELIST" ]; then
    return 0
  fi

  # Basic check for active configurations (non-blank, non-comment lines).
  ACTIVECONFIGS=$(grep -v "^[[:space:]]*\(#.*\)\?$" "$SOURCELIST" 2>/dev/null)

  # Check if the correct repository configuration is in there.
  REPOMATCH=$(grep -E "^[[:space:]#]*\b$REPOCONFIGREGEX\b" "$SOURCELIST" \
    2>/dev/null)

  # Check if the correct repository is disabled.
  MATCH_DISABLED=$(echo "$REPOMATCH" | grep "^[[:space:]]*#" 2>/dev/null)

  # Now figure out if we need to fix things.
  BADCONFIG=1
  if [ "$REPOMATCH" ]; then
    # If it's there and active, that's ideal, so nothing to do.
    if [ ! "$MATCH_DISABLED" ]; then
      BADCONFIG=0
    else
      # If it's not active, but neither is anything else, that's fine too.
      if [ ! "$ACTIVECONFIGS" ]; then
        BADCONFIG=0
      fi
    fi
  fi

  if [ $BADCONFIG -eq 0 ]; then
    return 0
  fi

  # At this point, either the correct configuration is completely missing, or
  # the wrong configuration is active. In that case, just abandon the mess and
  # recreate the file with the correct configuration. If there were no active
  # configurations before, create the new configuration disabled.
  DISABLE=""
  if [ ! "$ACTIVECONFIGS" ]; then
    DISABLE="#"
  fi
  printf "$SOURCES_PREAMBLE" > "$SOURCELIST"
  printf "$DISABLE$REPOCONFIG\n" >> "$SOURCELIST"
  if [ $? -eq 0 ]; then
    return 0
  fi
  return 2
}

# Add the Nimiq repository to the apt sources.
# Returns:
# 0 - sources list was created
# 2 - error
create_sources_lists() {
  if [ ! "$REPOCONFIG" ]; then
    return 0
  fi

  find_apt_sources

  SOURCELIST="$APT_SOURCESDIR/nimiq.list"
  if [ -d "$APT_SOURCESDIR" ]; then
    printf "$SOURCES_PREAMBLE" > "$SOURCELIST"
    printf "$REPOCONFIG\n" >> "$SOURCELIST"
    if [ $? -eq 0 ]; then
      return 0
    fi
  fi
  return 2
}

# Remove our custom sources list file.
# Returns:
# 0 - successfully removed, or not configured
# !0 - failed to remove
clean_sources_lists() {
  if [ ! "$REPOCONFIG" ]; then
    return 0
  fi

  find_apt_sources

  rm -f "$APT_SOURCESDIR/nimiq.list"
}

# Detect if the repo config was disabled by distro upgrade and enable if
# necessary.
handle_distro_upgrade() {
  if [ ! "$REPOCONFIG" ]; then
    return 0
  fi

  find_apt_sources
  SOURCELIST="$APT_SOURCESDIR/nimiq.list"
  if [ -r "$SOURCELIST" ]; then
    REPOLINE=$(grep -E "^[[:space:]]*#[[:space:]]*$REPOCONFIGREGEX[[:space:]]*# disabled on upgrade to .*" "$SOURCELIST")
    if [ $? -eq 0 ]; then
      sed -i -e "s,^[[:space:]]*#[[:space:]]*\(.*\)[[:space:]]*# disabled on upgrade to .*,\1," \
        "$SOURCELIST"
      LOGGER=$(which logger 2> /dev/null)
      if [ "$LOGGER" ]; then
        "$LOGGER" -t "$0" "Reverted repository modification: $REPOLINE."
      fi
    fi
  fi
}

## MAIN ##
DEFAULTS_FILE="/etc/default/nimiq"
if [ -r "$DEFAULTS_FILE" ]; then
  . "$DEFAULTS_FILE"
fi

install_key

if [ "$repo_add_once" = "true" ]; then
  create_sources_lists
  RES=$?
  # Sources creation succeeded, so stop trying.
  if [ $RES -ne 2 ]; then
    sed -i -e 's/[[:space:]]*repo_add_once=.*/repo_add_once="false"/' "$DEFAULTS_FILE"
  fi
else
  update_bad_sources
fi

if [ "$repo_reenable_on_distupgrade" = "true" ]; then
  handle_distro_upgrade
fi
