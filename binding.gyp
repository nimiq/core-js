{
    "targets": [
        {
            "target_name": "nimiq_node_compat",
            "sources": [
                "src/native/argon2.c",
                "src/native/blake2/blake2b.c",
                "src/native/core.c",
                "src/native/encoding.c",
                "src/native/nimiq_native.c",
                "src/native/ref.c",
                "src/native/sha256.c",
                "src/native/ed25519/collective.c",
                "src/native/ed25519/fe.c",
                "src/native/ed25519/ge.c",
                "src/native/ed25519/keypair.c",
                "src/native/ed25519/memory.c",
                "src/native/ed25519/sc.c",
                "src/native/ed25519/sha512.c",
                "src/native/ed25519/sign.c",
                "src/native/ed25519/verify.c",
                "src/native/nimiq_node.cc"
            ],
            "defines": [
                "ARGON2_NO_THREADS"
            ],
            "include_dirs": [
                "<!(node -e \"require('nan')\")",
                "src/native"
            ],
            "cflags_c": [
                "-std=c99",
                "-mtune=generic"
            ],
            "xcode_settings": {
                "OTHER_CFLAGS": [
                    "-mtune=generic"
                ]
            }
        },
        {
            "target_name": "nimiq_node_native",
            "sources": [
                "src/native/argon2.c",
                "src/native/blake2/blake2b.c",
                "src/native/core.c",
                "src/native/encoding.c",
                "src/native/nimiq_native.c",
                "src/native/opt.c",
                "src/native/sha256.c",
                "src/native/ed25519/collective.c",
                "src/native/ed25519/fe.c",
                "src/native/ed25519/ge.c",
                "src/native/ed25519/keypair.c",
                "src/native/ed25519/memory.c",
                "src/native/ed25519/sc.c",
                "src/native/ed25519/sha512.c",
                "src/native/ed25519/sign.c",
                "src/native/ed25519/verify.c",
                "src/native/nimiq_node.cc"
            ],
            "defines": [
                "ARGON2_NO_THREADS"
            ],
            "include_dirs": [
                "<!(node -e \"require('nan')\")",
                "src/native"
            ],
            "cflags_c": [
                "-std=c99",
                "-march=native"
            ],
            "xcode_settings": {
                "OTHER_CFLAGS": [
                    "-march=native"
                ]
            }
        },
        {
            "target_name": "nimiq_node_avx",
            "sources": [
                "src/native/argon2.c",
                "src/native/blake2/blake2b.c",
                "src/native/core.c",
                "src/native/encoding.c",
                "src/native/nimiq_native.c",
                "src/native/opt.c",
                "src/native/sha256.c",
                "src/native/ed25519/collective.c",
                "src/native/ed25519/fe.c",
                "src/native/ed25519/ge.c",
                "src/native/ed25519/keypair.c",
                "src/native/ed25519/memory.c",
                "src/native/ed25519/sc.c",
                "src/native/ed25519/sha512.c",
                "src/native/ed25519/sign.c",
                "src/native/ed25519/verify.c",
                "src/native/nimiq_node.cc"
            ],
            "defines": [
                "ARGON2_NO_THREADS"
            ],
            "include_dirs": [
                "<!(node -e \"require('nan')\")",
                "src/native"
            ],
            "cflags_c": [
                "-std=c99",
                "-mtune=generic",
                "-msse",
                "-msse2",
                "-mavx"
            ],
            "xcode_settings": {
                "OTHER_CFLAGS": [
                    "-mtune=generic",
                    "-msse",
                    "-msse2",
                    "-mavx"
                ]
            }
        },
        {
            "target_name": "nimiq_node_avx2",
            "sources": [
                "src/native/argon2.c",
                "src/native/blake2/blake2b.c",
                "src/native/core.c",
                "src/native/encoding.c",
                "src/native/nimiq_native.c",
                "src/native/opt.c",
                "src/native/sha256.c",
                "src/native/ed25519/collective.c",
                "src/native/ed25519/fe.c",
                "src/native/ed25519/ge.c",
                "src/native/ed25519/keypair.c",
                "src/native/ed25519/memory.c",
                "src/native/ed25519/sc.c",
                "src/native/ed25519/sha512.c",
                "src/native/ed25519/sign.c",
                "src/native/ed25519/verify.c",
                "src/native/nimiq_node.cc"
            ],
            "defines": [
                "ARGON2_NO_THREADS"
            ],
            "include_dirs": [
                "<!(node -e \"require('nan')\")",
                "src/native"
            ],
            "cflags_c": [
                "-std=c99",
                "-mtune=generic",
                "-msse",
                "-msse2",
                "-mavx",
                "-mavx2"
            ],
            "xcode_settings": {
                "OTHER_CFLAGS": [
                    "-mtune=generic",
                    "-msse",
                    "-msse2",
                    "-mavx",
                    "-mavx2"
                ]
            }
        },
        {
            "target_name": "nimiq_node_avx512f",
            "sources": [
                "src/native/argon2.c",
                "src/native/blake2/blake2b.c",
                "src/native/core.c",
                "src/native/encoding.c",
                "src/native/nimiq_native.c",
                "src/native/opt.c",
                "src/native/sha256.c",
                "src/native/ed25519/collective.c",
                "src/native/ed25519/fe.c",
                "src/native/ed25519/ge.c",
                "src/native/ed25519/keypair.c",
                "src/native/ed25519/memory.c",
                "src/native/ed25519/sc.c",
                "src/native/ed25519/sha512.c",
                "src/native/ed25519/sign.c",
                "src/native/ed25519/verify.c",
                "src/native/nimiq_node.cc"
            ],
            "defines": [
                "ARGON2_NO_THREADS"
            ],
            "include_dirs": [
                "<!(node -e \"require('nan')\")",
                "src/native"
            ],
            "cflags_c": [
                "-std=c99",
                "-msse",
                "-msse2",
                "-mavx",
                "-mavx2",
                "-mavx512f"
            ],
            "xcode_settings": {
                "OTHER_CFLAGS": [
                    "-msse",
                    "-msse2",
                    "-mavx",
                    "-mavx2",
                    "-mavx512f"
                ]
            }
        },
    ]
}
