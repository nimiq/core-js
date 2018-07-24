CFLAGS := -Wall -Werror -I. -DARGON2_NO_THREADS

EMCC := emcc
UGLIFY := uglifyjs
DISTDIR := ../../dist
EMCC_BASE_FLAGS := -s NO_FILESYSTEM=1 -s ASSERTIONS=0 -s USE_CLOSURE_COMPILER=1 -s EXPORTED_RUNTIME_METHODS=[]
EMCC_WASM_FLAGS := -s WASM=1 -s DEMANGLE_SUPPORT=0 -s WARN_UNALIGNED=1
EMCC_LIB_FLAGS := -s NO_EXIT_RUNTIME=1 -s MODULARIZE=1 \
    -s 'EXPORTED_FUNCTIONS=["_nimiq_blake2","_nimiq_argon2","_nimiq_argon2_no_wipe","_nimiq_argon2_verify","_nimiq_argon2_target","_nimiq_kdf","_nimiq_sha256","_nimiq_sha512","_ed25519_sign","_ed25519_verify","_get_static_memory_start","_get_static_memory_size","_ed25519_public_key_derive","_ed25519_create_commitment","_ed25519_add_scalars","_ed25519_aggregate_commitments","_ed25519_hash_public_keys","_ed25519_delinearize_public_key","_ed25519_aggregate_delinearized_public_keys","_ed25519_derive_delinearized_private_key","_ed25519_delinearized_partial_sign"]'
EMCC_OPT_FLAGS := -msse2

BASE_FILES := nimiq_native.c \
    argon2.c core.c encoding.c \
    blake2/blake2b.c \
    sha256.c \
    ed25519/collective.c ed25519/fe.c ed25519/ge.c ed25519/keypair.c \
    ed25519/memory.c ed25519/sc.c ed25519/sha512.c ed25519/sign.c ed25519/verify.c

ALL_TARGETS := test.html test.js test.wasm test worker-wasm.js worker-wasm.wasm worker-js.js
ALL_INSTALL := $(DISTDIR)/worker-wasm.js $(DISTDIR)/worker-js.js $(DISTDIR)/worker-wasm.wasm

default: worker-wasm.js worker-js.js

install: $(ALL_INSTALL)

installclean:
	rm -f $(ALL_INSTALL)

$(DISTDIR)/worker-wasm.js: worker-wasm.js suffix.js
	$(UGLIFY) $^ > $@

$(DISTDIR)/worker-js.js: worker-js.js suffix.js
	$(UGLIFY) $^ > $@

$(DISTDIR)/worker-wasm.wasm: worker-wasm.js
	cp worker-wasm.wasm $@

worker-wasm.js: $(BASE_FILES)
	$(EMCC) $(CFLAGS) -O3 -g $(EMCC_BASE_FLAGS) $(EMCC_LIB_FLAGS) $(EMCC_WASM_FLAGS) -o $@ $^ ref.c

worker-js.js: $(BASE_FILES)
	$(EMCC) $(CFLAGS) -O1 $(EMCC_BASE_FLAGS) $(EMCC_LIB_FLAGS) -o $@ $^ ref.c

test.html: $(BASE_FILES) nimiq_run.c
	$(EMCC) $(CFLAGS) -O3 -g $(EMCC_BASE_FLAGS) $(EMCC_WASM_FLAGS) -o $@ $^ ref.c

test: $(BASE_FILES) nimiq_run.c
	$(CC) -O3 -g $(CFLAGS) -march=native -mtune=native -o $@ $^ opt.c

clean:
	rm -f $(ALL_TARGETS)
