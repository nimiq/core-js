#ifndef __NIMIQ_NATIVE_H
#define __NIMIQ_NATIVE_H

#include "argon2.h"
#include "blake2/blake2.h"
#include "sha256.h"
#include "ed25519/sha512.h"

#define NIMIQ_ARGON2_SALT "nimiqrocks!"
#define NIMIQ_ARGON2_SALT_LEN 11
#define NIMIQ_DEFAULT_ARGON2_COST 512

int nimiq_blake2(void *out, const void *in, const size_t inlen);
int nimiq_argon2(void *out, const void *in, const size_t inlen, const uint32_t m_cost);
int nimiq_kdf(void *out, const void *in, const size_t inlen, const void* seed, const size_t seedlen, const uint32_t m_cost, const uint32_t iter);
uint32_t nimiq_argon2_target(void *out, void *in, const size_t inlen, const uint32_t compact, const uint32_t min_nonce, const uint32_t max_nonce, const uint32_t m_cost);
int nimiq_argon2_verify(const void *hash, const void *in, const size_t inlen, const uint32_t m_cost);
void nimiq_sha256(void *out, const void *in, const size_t inlen);
void nimiq_sha512(void *out, const void *in, const size_t inlen);

#endif
