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

# sources.list setting for nimiq updates.
REPOCONFIG="deb [arch=amd64] http://repo.nimiq.com/deb stable main"
REPOCONFIGREGEX="deb (\[arch=[^]]*\bamd64\b[^]]*\][[:space:]]*) https?://repo.nimiq.com/deb stable main"

APT_GET="`which apt-get 2> /dev/null`"
APT_CONFIG="`which apt-config 2> /dev/null`"

SOURCES_PREAMBLE="### THIS FILE IS AUTOMATICALLY CONFIGURED ###
# You may comment out this entry, but any other modifications may be lost.\n"

# Install the repository/package signing key, if they aren't already.
install_key() {
  APT_KEY="`which apt-key 2> /dev/null`"
  if [ ! -x "$APT_KEY" ]; then
    return
  fi

  NEED_KEYS=0

  # 2018 signing subkey XXX: update the key when the official one is ready
  "$APT_KEY" export 7CFB047916EB673E0D928C14F84031083785D050 2>&1 | \
    grep -q -- "-----BEGIN PGP PUBLIC KEY BLOCK-----"
  if [ $? -ne 0 ]; then
    NEED_KEYS=1
  fi

  if [ $NEED_KEYS -eq 1 ]; then
    "$APT_KEY" add - >/dev/null 2>&1 <<KEYDATA
-----BEGIN PGP PUBLIC KEY BLOCK-----

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
=CFGF
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
