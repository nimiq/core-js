CFLAGS := -Wall -Werror

EMCC := emcc
UGLIFY := uglifyjs
DISTDIR := ../../dist
EMCC_BASE_FLAGS := -s NO_FILESYSTEM=1 -s ASSERTIONS=0 -s USE_CLOSURE_COMPILER=1 -s EXPORTED_RUNTIME_METHODS=[]
EMCC_WASM_FLAGS := -s WASM=1 -s DEMANGLE_SUPPORT=0 -s WARN_UNALIGNED=1
EMCC_LIB_FLAGS := -s 'EXPORTED_FUNCTIONS=["_nimiq_light_hash","_nimiq_hard_hash","_nimiq_hard_verify","_nimiq_hard_hash_target","_ed25519_sign","_ed25519_verify","_get_static_memory_start","_get_static_memory_size","_ed25519_public_key_derive"]' -s NO_EXIT_RUNTIME=1 -s MODULARIZE=1

BASE_FILES := argon2.c blake2b.c core.c encoding.c nimiq_native.c ref.c ed25519/fe.c ed25519/ge.c ed25519/keypair.c \
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
	$(EMCC) $(CFLAGS) -O3 $(EMCC_BASE_FLAGS) $(EMCC_LIB_FLAGS) $(EMCC_WASM_FLAGS) -o $@ $^

worker-js.js: $(BASE_FILES)
	$(EMCC) $(CFLAGS) -O1 $(EMCC_BASE_FLAGS) $(EMCC_LIB_FLAGS) -o $@ $^

test.html: $(BASE_FILES) run.c
	$(EMCC) $(CFLAGS) -g $(EMCC_BASE_FLAGS) $(EMCC_WASM_FLAGS) -o $@ $^

test: $(BASE_FILES) run.c
	$(CC) -g $(CFLAGS) -o $@ $^

clean:
	rm -f $(ALL_TARGETS)
