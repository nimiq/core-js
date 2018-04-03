%global __os_install_post %{nil}
%global __arch_install_post %{nil}
%define debug_package %{nil}
%define _topdir %(echo $PWD)/

Name:           nimiq
Version:        0.9.1
Release:        1
Summary:        Nimiq node.js client

License:        ASL 2.0
URL:            https://nimiq.com/
Source0:        https://github.com/nimiq-network/core.git

%{?systemd_requires}
BuildRequires:  systemd

Requires:       bash
Requires:       systemd

Requires(pre): shadow-utils

AutoReqProv: no


%description
Nimiq node.js client


%install
rm -rf $RPM_BUILD_ROOT

sed -i 's:{{ cli_entrypoint }}:node /usr/share/nimiq/index.js:' nimiq

mkdir -p %{buildroot}%{_bindir}
mkdir -p %{buildroot}%{_sysconfdir}/%{name}
mkdir -p %{buildroot}%{_sysconfdir}/cron.daily
mkdir -p %{buildroot}%{_datarootdir}/%{name}
mkdir -p %{buildroot}%{_unitdir}
mkdir -p %{buildroot}%{_sharedstatedir}/%{name}

install -m 0755 %{name} %{buildroot}%{_bindir}/
install -m 0600 fakeroot/etc/nimiq/%{name}.conf %{buildroot}%{_sysconfdir}/%{name}/
install -m 0755 cron-rpm.sh %{buildroot}%{_sysconfdir}/cron.daily/%{name}
install -m 0755 node %{buildroot}%{_datarootdir}/%{name}/
install -m 0644 index.js package.json VERSION %{buildroot}%{_datarootdir}/%{name}/
cp -r lib/ modules/ node_modules/ %{buildroot}%{_datarootdir}/%{name}/
install -m 0644 systemd.service %{buildroot}%{_unitdir}/%{name}.service


%files
%{_bindir}/%{name}
%{_sysconfdir}/cron.daily/nimiq
%{_datarootdir}/%{name}/node
%{_datarootdir}/%{name}/index.js
%{_datarootdir}/%{name}/package.json
%{_datarootdir}/%{name}/VERSION
%{_datarootdir}/%{name}/lib
%{_datarootdir}/%{name}/modules
%{_datarootdir}/%{name}/node_modules
%{_unitdir}/%{name}.service

%defattr(600, nimiq, nimiq, 700)
%dir %{_sharedstatedir}/%{name}
%config(noreplace) %{_sysconfdir}/%{name}/%{name}.conf


%pre
getent group nimiq >/dev/null || groupadd -r nimiq
getent passwd nimiq >/dev/null || \
    useradd -r -g nimiq -d /usr/share/nimiq -s /sbin/nologin \
    -c "User with restricted privileges for Nimiq daemon" nimiq
exit 0


%post
# System-wide package configuration.
DEFAULTS_FILE="/etc/default/nimiq"

# sources.list setting for nimiq updates. XXX update this when the official repo is ready
REPOCONFIG="http://test.nimiq.space/rpm/stable"
REPOCONFIGREGEX=""

# Install the repository/package signing key (see also:
# XXX update this when the official repo is ready)
install_rpm_key() {
  KEY_PACKAGE="gpg-pubkey-1f7126fe-5aaef790"
  # Check to see if all keys already exists.
  # Make sure all the most recent signing subkeys are installed.
  NEED_KEYS=0

  # 2018 signing subkey XXX: update the key when the official one is ready
  rpm -q ${KEY_PACKAGE} --qf '%{Pubkeys:armor}\n' | \
    gpg --with-colons - 2>/dev/null | \
    grep -q 0D30878BE7CC893C
  if [ "$?" -ne "0" ]; then
    NEED_KEYS=1
  fi

  if [ $NEED_KEYS -ne 1 ]; then
    return
  fi

  # Make sure no older version of the key is installed because it appears
  # 'rpm --import' won't overwrite an existing key package.
  rpm -q ${KEY_PACKAGE} >/dev/null 2>&1
  if [ "$?" -eq "0" ]; then
    # Note, if this is run during the package install, it will fail because rpm
    # can't recursively run rpm, but it should work when run later as part of
    # the installed cron job (and probably nothing needs the new keys before
    # then).
    rpm -e --allmatches ${KEY_PACKAGE} >/dev/null 2>&1 || return
  fi

  # RPM on Mandriva 2009 is dumb and does not understand "rpm --import -"
  TMPKEY=$(mktemp /tmp/nimiq.sig.XXXXXX)
  if [ -n "$TMPKEY" ]; then
    cat > "$TMPKEY" <<KEYDATA
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
    rpm --import "$TMPKEY"
    rc=$?
    rm -f "$TMPKEY"
    if [ "$rc" -eq "0" ]; then
      return 0
    fi
  fi
  return 1
}

determine_rpm_package_manager() {
  local RELEASE
  LSB_RELEASE="$(which lsb_release 2> /dev/null)"
  if [ -x "$LSB_RELEASE" ]; then
    RELEASE=$(lsb_release -i 2> /dev/null | sed 's/:\t/:/' | cut -d ':' -f 2-)
    case $RELEASE in
    "Fedora")
      PACKAGEMANAGERS=(yum)
      ;;
    "Mageia")
      PACKAGEMANAGERS=(urpmi)
      if [ "$(lsb_release -rs 2> /dev/null)" -ge "6" ]; then
        PACKAGEMANAGERS=(yum urpmi)
      fi
      ;;
    "MandrivaLinux")
      PACKAGEMANAGERS=(urpmi)
      ;;
    "SUSE LINUX")
      PACKAGEMANAGERS=(yast)
      ;;
    esac
  fi

  if [ "$PACKAGEMANAGERS" ]; then
    return
  fi

  # Fallback methods that are probably unnecessary on modern systems.
  if [ -f "/etc/lsb-release" ]; then
    # file missing on Fedora, does not contain DISTRIB_ID on OpenSUSE.
    eval $(sed -e '/DISTRIB_ID/!d' /etc/lsb-release)
    case $DISTRIB_ID in
    MandrivaLinux)
      PACKAGEMANAGERS=(urpmi)
      ;;
    esac
  fi

  if [ "$PACKAGEMANAGERS" ]; then
    return
  fi

  if [ -f "/etc/fedora-release" ] || [ -f "/etc/redhat-release" ]; then
    PACKAGEMANAGERS=(yum)
  elif [ -f "/etc/SuSE-release" ]; then
    PACKAGEMANAGERS=(yast)
  elif [ -f "/etc/mandriva-release" ]; then
    PACKAGEMANAGERS=(urpmi)
  fi
}

DEFAULT_ARCH="x86_64"
YUM_REPO_FILE="/etc/yum.repos.d/nimiq.repo"
ZYPPER_REPO_FILE="/etc/zypp/repos.d/nimiq.repo"
URPMI_REPO_FILE="/etc/urpmi/urpmi.cfg"

install_yum() {
  install_rpm_key

  if [ ! "$REPOCONFIG" ]; then
    return 0
  fi

  if [ -d "/etc/yum.repos.d" ]; then
cat > "$YUM_REPO_FILE" << REPOCONTENT
[nimiq]
name=nimiq
baseurl=$REPOCONFIG/$DEFAULT_ARCH
enabled=1
gpgcheck=1
gpgkey=https://test.nimiq.space/nimiq-repo.pub
REPOCONTENT
  fi
}

# This is called by the cron job, rather than in the RPM postinstall.
# We cannot do this during the install when urpmi is running due to
# database locking. We also need to enable the repository, and we can
# only do that while we are online.
# see: https://qa.mandriva.com/show_bug.cgi?id=31893
configure_urpmi() {
  if [ ! "$REPOCONFIG" ]; then
    return 0
  fi

  urpmq --list-media | grep -q -s "^nimiq$"
  if [ "$?" -eq "0" ]; then
    # Repository already configured
    return 0
  fi
  urpmi.addmedia --update \
    "nimiq" "$REPOCONFIG/$DEFAULT_ARCH"
}

install_urpmi() {
  # urpmi not smart enough to pull media_info/pubkey from the repository?
  install_rpm_key

  # Defer urpmi.addmedia to configure_urpmi() in the cron job.
  # See comment there.
  #
  # urpmi.addmedia --update \
  #   "nimiq" "$REPOCONFIG/$DEFAULT_ARCH"
}

install_yast() {
  if [ ! "$REPOCONFIG" ]; then
    return 0
  fi

  # We defer adding the key to later. See comment in the cron job.

  # Ideally, we would run: zypper addrepo -t YUM -f \
  # "$REPOCONFIG/$DEFAULT_ARCH" "nimiq"
  # but that does not work when zypper is running.
  if [ -d "/etc/zypp/repos.d" ]; then
cat > "$ZYPPER_REPO_FILE" << REPOCONTENT
[nimiq]
name=nimiq
enabled=1
autorefresh=1
baseurl=$REPOCONFIG/$DEFAULT_ARCH
type=rpm-md
keeppackages=0
REPOCONTENT
  fi
}

# Check if the automatic repository configuration is done, so we know when to
# stop trying.
verify_install() {
  # It's probably enough to see that the repo configs have been created. If they
  # aren't configured properly, update_bad_repo should catch that when it's run.
  case $1 in
  "yum")
    [ -f "$YUM_REPO_FILE" ]
    ;;
  "yast")
    [ -f "$ZYPPER_REPO_FILE" ]
    ;;
  "urpmi")
    urpmq --list-url | grep -q -s "\bnimiq\b"
    ;;
  esac
}

# Update the Nimiq repository if it's not set correctly.
update_bad_repo() {
  if [ ! "$REPOCONFIG" ]; then
    return 0
  fi

  determine_rpm_package_manager

  for PACKAGEMANAGER in ${PACKAGEMANAGERS[*]}
  do
    case $PACKAGEMANAGER in
    "yum")
      update_repo_file "$YUM_REPO_FILE"
      ;;
    "yast")
      update_repo_file "$ZYPPER_REPO_FILE"
      ;;
    "urpmi")
      update_urpmi_cfg
      ;;
    esac
  done
}

update_repo_file() {
  REPO_FILE="$1"

  # Don't do anything if the file isn't there, since that probably means the
  # user disabled it.
  if [ ! -r "$REPO_FILE" ]; then
    return 0
  fi

  # Check if the correct repository configuration is in there.
  REPOMATCH=$(grep "^baseurl=$REPOCONFIG/$DEFAULT_ARCH" "$REPO_FILE" \
    2>/dev/null)
  # If it's there, nothing to do
  if [ "$REPOMATCH" ]; then
    return 0
  fi

  # Check if it's there but disabled by commenting out (as opposed to using the
  # 'enabled' setting).
  MATCH_DISABLED=$(grep "^[[:space:]]*#.*baseurl=$REPOCONFIG/$DEFAULT_ARCH" \
    "$REPO_FILE" 2>/dev/null)
  if [ "$MATCH_DISABLED" ]; then
    # It's OK for it to be disabled, as long as nothing bogus is enabled in its
    # place.
    ACTIVECONFIGS=$(grep "^baseurl=.*" "$REPO_FILE" 2>/dev/null)
    if [ ! "$ACTIVECONFIGS" ]; then
      return 0
    fi
  fi

  # If we get here, the correct repository wasn't found, or something else is
  # active, so fix it. This assumes there is a 'baseurl' setting, but if not,
  # then that's just another way of disabling, so we won't try to add it.
  sed -i -e "s,^baseurl=.*,baseurl=$REPOCONFIG/$DEFAULT_ARCH," "$REPO_FILE"
}

update_urpmi_cfg() {
  REPOCFG=$(urpmq --list-url | grep "\bnimiq\b")
  if [ ! "$REPOCFG" ]; then
    # Don't do anything if the repo isn't there, since that probably means the
    # user deleted it.
    return 0
  fi

  # See if it's the right repo URL
  REPOMATCH=$(echo "$REPOCFG" | grep "\b$REPOCONFIG/$DEFAULT_ARCH\b")
  # If so, nothing to do
  if [ "$REPOMATCH" ]; then
    return 0
  fi

  # Looks like it's the wrong URL, so recreate it.
  urpmi.removemedia "nimiq" && \
    urpmi.addmedia --update "nimiq" "$REPOCONFIG/$DEFAULT_ARCH"
}

# We only remove the repository configuration during a purge. Since RPM has
# no equivalent to dpkg --purge, the code below is actually never used. We
# keep it only for reference purposes, should we ever need it.
#
#remove_yum() {
#  rm -f "$YUM_REPO_FILE"
#}
#
#remove_urpmi() {
#  # Ideally, we would run: urpmi.removemedia "nimiq"
#  # but that does not work when urpmi is running.
#  # Sentinel comment text does not work either because urpmi.update removes
#  # all comments. So we just delete the entry that matches what we originally
#  # inserted. If such an entry was added manually, that's tough luck.
#  if [ -f "$URPMI_REPO_FILE" ]; then
#    sed -i '\_^nimiq $REPOCONFIG/$DEFAULT_ARCH {$_,/^}$/d' "$URPMI_REPO_FILE"
#  fi
#}
#
#remove_yast() {
#  # Ideally, we would run: zypper removerepo "nimiq"
#  # but that does not work when zypper is running.
#  rm -f /etc/zypp/repos.d/nimiq.repo
#}

DEFAULTS_FILE="/etc/default/nimiq"
if [ ! -e "$DEFAULTS_FILE" ]; then
  echo 'repo_add_once="true"' > "$DEFAULTS_FILE"
fi

. "$DEFAULTS_FILE"

if [ "$repo_add_once" = "true" ]; then
  determine_rpm_package_manager

  for PACKAGEMANAGER in ${PACKAGEMANAGERS[*]}
  do
    case $PACKAGEMANAGER in
    "yum")
      install_yum
      ;;
    "urpmi")
      install_urpmi
      ;;
    "yast")
      install_yast
      ;;
    esac
  done
fi

# Some package managers have locks that prevent everything from being
# configured at install time, so wait a bit then kick the cron job to do
# whatever is left. Probably the db will be unlocked by then, but if not, the
# cron job will keep retrying.
# Do this with 'at' instead of a backgrounded shell because zypper waits on all
# sub-shells to finish before it finishes, which is exactly the opposite of
# what we want here. Also preemptively start atd because for some reason it's
# not always running, which kind of defeats the purpose of having 'at' as a
# required LSB command.
service atd start
echo "sh /etc/cron.daily/nimiq" | at now + 2 minute > /dev/null 2>&1

CHANNEL=stable
case $CHANNEL in
  stable )
    PRIORITY=200
    ;;
  beta )
    PRIORITY=150
    ;;
  unstable )
    PRIORITY=120
    ;;
  * )
    PRIORITY=0
    ;;
esac

%systemd_post nimiq.service


%preun
%systemd_preun nimiq.service


%postun
%systemd_postun_with_restart nimiq.service
