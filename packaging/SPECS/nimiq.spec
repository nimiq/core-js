%global __os_install_post %{nil}
%global __arch_install_post %{nil}
%define debug_package %{nil}
%define _topdir %(echo $PWD)/

Name:           nimiq
Version:        1.2.0
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
mkdir -p %{buildroot}%{_sysconfdir}/pki/rpm-gpg
mkdir -p %{buildroot}%{_sysconfdir}/yum.repos.d
mkdir -p %{buildroot}%{_datarootdir}/%{name}
mkdir -p %{buildroot}%{_unitdir}
mkdir -p %{buildroot}%{_sharedstatedir}/%{name}

install -m 0755 %{name} %{buildroot}%{_bindir}/
install -m 0600 fakeroot/etc/nimiq/%{name}.conf %{buildroot}%{_sysconfdir}/%{name}/
install -m 0666 nimiq.repo %{buildroot}%{_sysconfdir}/yum.repos.d/
install -m 0666 RPM-GPG-KEY-nimiq %{buildroot}%{_sysconfdir}/pki/rpm-gpg/
install -m 0755 node %{buildroot}%{_datarootdir}/%{name}/
install -m 0644 index.js package.json VERSION %{buildroot}%{_datarootdir}/%{name}/
cp -r build/ lib/ modules/ node_modules/ %{buildroot}%{_datarootdir}/%{name}/
install -m 0644 systemd.service %{buildroot}%{_unitdir}/%{name}.service


%files
%{_bindir}/%{name}
%{_sysconfdir}/yum.repos.d/nimiq.repo
%{_sysconfdir}/pki/rpm-gpg/RPM-GPG-KEY-nimiq
%{_datarootdir}/%{name}/node
%{_datarootdir}/%{name}/index.js
%{_datarootdir}/%{name}/package.json
%{_datarootdir}/%{name}/VERSION
%{_datarootdir}/%{name}/lib
%{_datarootdir}/%{name}/build
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
%systemd_post nimiq.service


%preun
%systemd_preun nimiq.service


%postun
%systemd_postun_with_restart nimiq.service
