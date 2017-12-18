#ifndef ED25519_H
#define ED25519_H

#include <stddef.h>

#if defined(_WIN32)
    #if defined(ED25519_BUILD_DLL)
        #define ED25519_DECLSPEC __declspec(dllexport)
    #elif defined(ED25519_DLL)
        #define ED25519_DECLSPEC __declspec(dllimport)
    #else
        #define ED25519_DECLSPEC
    #endif
#else
    #define ED25519_DECLSPEC
#endif


#ifdef __cplusplus
extern "C" {
#endif

/* Common functions */
void ed25519_private_key_decompress(unsigned char *az, const unsigned char *private_key);
int ED25519_DECLSPEC ed25519_verify(const unsigned char *signature, const unsigned char *message, size_t message_len, const unsigned char *public_key);

/* Single signature functions */
void ED25519_DECLSPEC ed25519_public_key_derive(unsigned char *out_public_key, const unsigned char *private_key);
void ED25519_DECLSPEC ed25519_sign(unsigned char *signature, const unsigned char *message, size_t message_len, const unsigned char *public_key, const unsigned char *private_key);

/* Common multisig functions */
int ED25519_DECLSPEC ed25519_create_commitment(unsigned char *secret_r, unsigned char *commitment_R, const unsigned char *randomness);
void ED25519_DECLSPEC ed25519_aggregate_commitments(unsigned char *aggregate_commitment, const unsigned char *commitments, const size_t num_commitments);
void ED25519_DECLSPEC ed25519_add_scalars(unsigned char *scalar_AB, const unsigned char *scalar_A, const unsigned char *scalar_B);

/* Delinearized multisig functions */
void ED25519_DECLSPEC ed25519_hash_public_keys(unsigned char *hash, const unsigned char *public_keys, const size_t num_public_keys);
void ED25519_DECLSPEC ed25519_delinearize_public_key(unsigned char *delinearized_public_key, const unsigned char *public_keys_hash, const unsigned char *public_key);
void ED25519_DECLSPEC ed25519_aggregate_delinearized_public_keys(unsigned char *aggregate_public_key, const unsigned char *public_keys_hash, const unsigned char *public_keys, const size_t num_public_keys);
void ED25519_DECLSPEC ed25519_derive_delinearized_private_key(unsigned char *multisig_private_key, const unsigned char *public_keys_hash, const unsigned char *public_key, const unsigned char *private_key);
void ED25519_DECLSPEC ed25519_delinearized_partial_sign(unsigned char *partial_signature, const unsigned char *message, size_t message_len, const unsigned char* commitment_R, const unsigned char *secret_r, const unsigned char *public_keys, size_t num_cosigners, const unsigned char *public_key, const unsigned char *private_key);

#ifdef __cplusplus
}
#endif

#endif
