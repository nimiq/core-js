#include "argon2.h"
#include "blake2.h"

#define NIMIQ_ARGON2_SALT "nimiqrocks!"
#define NIMIQ_ARGON2_SALT_LEN 11
#define NIMIQ_DEFAULT_ARGON2_COST 1024

int nimiq_light_hash(void *out, const void *in, const size_t inlen);
int nimiq_hard_hash(void *out, const void *in, const size_t inlen, const uint32_t m_cost);
uint32_t nimiq_hard_hash_target(void *out, void *in, const size_t inlen, const uint32_t compact, const uint32_t min_nonce, const uint32_t max_nonce, const uint32_t m_cost);
int nimiq_hard_verify(const void *hash, const void *in, const size_t inlen, const uint32_t m_cost);
