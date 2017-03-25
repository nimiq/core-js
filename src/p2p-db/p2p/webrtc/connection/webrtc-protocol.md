# Web-rtc Protocol

- Session Description Protocol (SDP)
- Interactive Connectivity Establishment (ICE)

- [SDP & ICE Anatomy](https://webrtchacks.com/sdp-anatomy/)

## Handshake 

### Offer

```
{
	"sdp": {
		"type":"offer",
		"sdp": `v=0
				o=- 4180923533468039353 2 IN IP4 127.0.0.1
				s=-
				t=0 0
				a=group:BUNDLE data
				a=msid-semantic: WMS
				m=application 51377 DTLS/SCTP 5000
				c=IN IP4 192.168.0.3
				a=candidate:3802297132 1 udp 2113937151 192.168.0.3 51377 typ host generation 0 network-cost 50
				a=candidate:3340921450 1 udp 2113939711 2a02:810c:84c0:579:c049:543e:d4a4:b0ba 32853 typ host generation 0 network-cost 50
				a=ice-ufrag:WdJ0
				a=ice-pwd:ZEAjTPMS9mEejlMII04gi6dY
				a=fingerprint:sha-256 C8:0F:56:06:25:AB:96:97:1F:28:48:EA:53:35:3C:65:84:7B:04:67:83:5B:12:15:3D:70:7A:05:14:78:D8:3F
				a=setup:actpass
				a=mid:data
				a=sctpmap:5000 webrtc-datachannel 1024
				`
	}	
}


{
	"ice":{
		"candidate":"candidate:3802297132 1 udp 2113937151 192.168.0.3 51377 typ host generation 0 ufrag WdJ0 network-cost 50",
		"sdpMid":"data",
		"sdpMLineIndex":0
		}
}


{
	"ice":{
		"candidate":"candidate:3340921450 1 udp 2113939711 2a02:810c:84c0:579:c049:543e:d4a4:b0ba 32853 typ host generation 0 ufrag WdJ0 network-cost 50",
		"sdpMid":"data",
		"sdpMLineIndex":0
	}
}
```

## Answer 
```
{
	"sdp":{
		"type":"answer",
		"sdp": "v=0
				o=- 3028091918594973688 2 IN IP4 127.0.0.1
				s=-
				t=0 0
				a=group:BUNDLE data
				a=msid-semantic: WMS
				m=application 52230 DTLS/SCTP 5000
				c=IN IP4 192.168.0.3
				b=AS:30
				a=candidate:3802297132 1 udp 2113937151 192.168.0.3 52230 typ host generation 0 network-cost 50
				a=ice-ufrag:cCfg
				a=ice-pwd:eEnJdlO+w5qrLW4urJEPoLEQ
				a=fingerprint:sha-256 AF:5F:6A:1C:BA:D3:5B:A8:18:3A:72:4E:F6:58:CD:38:16:CF:E5:B0:9D:82:3C:B7:FB:15:2A:3F:0B:86:91:66
				a=setup:active
				a=mid:data
				a=sctpmap:5000 webrtc-datachannel 1024"
	}
}

{
	"ice":{
		"candidate":"candidate:3802297132 1 udp 2113937151 192.168.0.3 52230 typ host generation 0 ufrag cCfg network-cost 50",
		"sdpMid":"data",
		"sdpMLineIndex":0
	}
}

{
	"ice":{
		"candidate":"candidate:3340921450 1 udp 2113939711 2a02:810c:84c0:579:c049:543e:d4a4:b0ba 43573 typ host generation 0 ufrag cCfg network-cost 50",
		"sdpMid":"data",
		"sdpMLineIndex":0
	}
}

```












### Session 2
*SDP*

```
{
	"sdp": {
		"type":"offer",
		"sdp":` v=0
				o=- 2606993259373190070 2 IN IP4 127.0.0.1
				s=-
				t=0 0
				a=msid-semantic: WMS
				m=application 9 DTLS/SCTP 5000
				c=IN IP4 0.0.0.0
				a=ice-ufrag:gTYb
				a=ice-pwd:JrViyoMip3HeyrPaXekgVJfI
				a=fingerprint:sha-256 
				98:AC:5B:A8:97:7A:59:B8:D4:E7:AE:D7:F1:21:0C:BE:68:D1:B6:0D:3B:11:78:A0:72:DB:88:77:A7:C3:40:02
				a=setup:actpass
				a=mid:data
				a=sctpmap:5000 webrtc-datachannel 1024
	`}
}
```

```
{
	"ice":{
		"candidate": "candidate:842163049 1 udp 1677729535 << MY GLOBAL IP >> 17347 typ srflx raddr 0.0.0.0 rport 0 generation 0 ufrag gTYb network-cost 50","sdpMid":"data","sdpMLineIndex":0
	}
}
```

### Session 2
```
{
	"sdp":{
		"type":"offer",
		"sdp":`v=0
		o=- 8738500617928525117 2 IN IP4 127.0.0.1
		s=-
		t=0 0
		a=group:BUNDLE data
		a=msid-semantic: WMS
		m=application 9 DTLS/SCTP 5000
		c=IN IP4 0.0.0.0
		a=ice-ufrag:Anc6
		a=ice-pwd:1kTRaYlfCP+MUGFqOrwmC1yq
		a=fingerprint:sha-256 DF:1C:BC:05:53:E9:E8:C5:60:CD:F7:C3:6F:72:67:E8:01:62:EA:61:E4:32:50:00:48:75:28:D7:55:2E:02:BC
		a=setup:actpass
		a=mid:data
		a=sctpmap:5000 webrtc-datachannel 1024
		`
	}
}
```

```
{
	"ice": {
		"candidate":"candidate:3802297132 1 udp 2113937151 192.168.0.3 55845 typ host generation 0 ufrag Anc6 network-cost 50",
		"sdpMid":"data",
		"sdpMLineIndex":0
	}
}
```

```
{
	"ice": {
		"candidate":"candidate:2554582526 1 udp 2113939711 2a02:810c:84c0:579:6ce5:510e:40bd:e97e 48069 typ host generation 0 ufrag Anc6 network-cost 50",
		"sdpMid":"data",
		"sdpMLineIndex":0
	}
}
```

# Session 3 RAW

```
{"sdp":{
	"type":"offer",
	"sdp":"
		v=0
		o=- 2886098926969343226 2 IN IP4 127.0.0.1
		s=-
		t=0 0
		a=group:BUNDLE data
		a=msid-semantic: WMS
		m=application 9 DTLS/SCTP 5000
		c=IN IP4 0.0.0.0
		a=ice-ufrag:fv2Z
		a=ice-pwd:i1braBA1GvKUNm7WG2XOsCge
		a=fingerprint:sha-256 86:7D:7C:14:30:16:35:38:2D:B7:7F:E3:18:8A:EE:E2:57:8F:9A:5D:49:CD:44:57:20:B1:7D:9D:B4:64:81:23
		a=setup:actpass
		a=mid:data
		a=sctpmap:5000 webrtc-datachannel 1024
"}},

{"ice":{"candidate":"candidate:3802297132 1 udp 2113937151 192.168.0.3 60171 typ host generation 0 ufrag fv2Z network-cost 50","sdpMid":"data","sdpMLineIndex":0}}
{"ice":{"candidate":"candidate:2554582526 1 udp 2113939711 2a02:810c:84c0:579:6ce5:510e:40bd:e97e 43323 typ host generation 0 ufrag fv2Z network-cost 50","sdpMid":"data","sdpMLineIndex":0}}
```