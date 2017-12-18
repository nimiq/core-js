#include "ed25519.h"
#include "sha512.h"
#include "ge.h"
#include "sc.h"

/*
 * Necessary tools for collective signatures.
 * Our implementation is inspired by:
 * https://tools.ietf.org/id/draft-ford-cfrg-cosi-00.html
 * It differs from it that we only implement n-of-n signatures,
 * simplifying some of the protocol steps.
 * Moreover, we rely on delinearization to counter related-key attacks as described in:
 * https://www.docdroid.net/CNSEbvn/aggregates.pdf#page=7
 */

/*
 * Derives a public key commitment H(P_1 || ... || P_n).
 */

void ed25519_hash_public_keys(unsigned char *hash, const unsigned char *public_keys, const size_t num_public_keys) {
    sha512(public_keys, num_public_keys*32, hash);
}

/*
 * Let public_keys_hash = C = H(P_1 || ... || P_n).
 * Derives a public key H(C||P)P used for multisignatures.
 */

void ed25519_derive_delinearized_private_key(unsigned char *multisig_private_key, const unsigned char *public_keys_hash, const unsigned char *public_key, const unsigned char *private_key) {
    sha512_context hash;
    unsigned char r[64];
    unsigned char az[64];
    const unsigned char SC_0[32] = {0}; /* scalar with value 0 */

    // Compute H(C||P).
    sha512_init(&hash);
    sha512_update(&hash, public_keys_hash, 64);
    sha512_update(&hash, public_key, 32);
    sha512_final(&hash, r);

    // Reduce hash to group.
    sc_reduce(r);

    // Decompress the 32 byte private key to 64 byte.
    ed25519_private_key_decompress(az, private_key);

    // a * b + c
    sc_muladd(multisig_private_key, r, az, SC_0);
}

/*
 * Let C = public_keys_hash = H(P_1 || ... || P_n).
 * Aggregates a set of public keys P_1, ..., P_n to P = ∑ H(C || P_i) P_i.
 */

void ed25519_aggregate_delinearized_public_keys(unsigned char *aggregate_public_key, const unsigned char *public_keys_hash, const unsigned char *public_keys, const size_t num_public_keys) {
    unsigned char delinearized_public_key[32];
    ge_p1p1 sum_tmp;
    ge_p3 sum;
    ge_p3 delinearized_public_key_unpacked;
    ge_cached delinearized_public_key_cached;

    ge_p3_0(&sum);

    for (size_t i = 0; i < num_public_keys; ++i) {
        const unsigned char *public_key = public_keys + (i * 32);

        ed25519_delinearize_public_key(delinearized_public_key, public_keys_hash, public_key);

        /* unpack delinearized public key */
        ge_frombytes_negate_vartime(&delinearized_public_key_unpacked, delinearized_public_key);
        fe_neg(delinearized_public_key_unpacked.X, delinearized_public_key_unpacked.X); /* undo negate */
        fe_neg(delinearized_public_key_unpacked.T, delinearized_public_key_unpacked.T); /* undo negate */

        if (i == 0) {
            sum = delinearized_public_key_unpacked;
            continue;
        }
        
        ge_p3_to_cached(&delinearized_public_key_cached, &delinearized_public_key_unpacked);
        
        /* sum = sum + public key */
        ge_add(&sum_tmp, &sum, &delinearized_public_key_cached);
        ge_p1p1_to_p3(&sum, &sum_tmp);
    }
    
    /* pack point */
    ge_p3_tobytes(aggregate_public_key, &sum);
}

/*
 * Let public_keys_hash = C = H(P_1 || ... || P_n).
 * Delinearizes a public key P' = H(C || P) P.
 */

void ed25519_delinearize_public_key(unsigned char *delinearized_public_key, const unsigned char *public_keys_hash, const unsigned char *public_key) {
    sha512_context hash;
    unsigned char pH[64];
    ge_p3 P;
    ge_p2 P_prime;
    const unsigned char SC_0[32] = {0}; /* scalar with value 0 */

    // Compute P.
    /* unpack point public_key into P */
    ge_frombytes_negate_vartime(&P, public_key);
    fe_neg(P.X, P.X); /* undo negate */
    fe_neg(P.T, P.T); /* undo negate */

    // Compute H(C||P).
    sha512_init(&hash);
    sha512_update(&hash, public_keys_hash, 64);
    sha512_update(&hash, public_key, 32);
    sha512_final(&hash, pH);
    sc_reduce(pH);

    // Compute H(C||P)P.
    ge_double_scalarmult_vartime(&P_prime, pH, &P, SC_0);
    ge_tobytes(delinearized_public_key, &P_prime);
}

/*
 * Aggregates a set of commitments.
 */

void ed25519_aggregate_commitments(unsigned char *aggregate_commitment, const unsigned char *commitments, const size_t num_commitments) {
    ge_p1p1 sum_tmp;
    ge_p3 sum;
    ge_p3 commitment_unpacked;
    ge_cached commitment_cached;

    ge_p3_0(&sum);

    for (size_t i = 0; i < num_commitments; ++i) {
        const unsigned char *commitment = commitments + (i * 32);

        /* unpack delinearized public key */
        ge_frombytes_negate_vartime(&commitment_unpacked, commitment);
        fe_neg(commitment_unpacked.X, commitment_unpacked.X); /* undo negate */
        fe_neg(commitment_unpacked.T, commitment_unpacked.T); /* undo negate */

        if (i == 0) {
            sum = commitment_unpacked;
            continue;
        }
        
        ge_p3_to_cached(&commitment_cached, &commitment_unpacked);
        
        /* sum = sum + public key */
        ge_add(&sum_tmp, &sum, &commitment_cached);
        ge_p1p1_to_p3(&sum, &sum_tmp);
    }
    
    /* pack point */
    ge_p3_tobytes(aggregate_commitment, &sum);
}

/*
 * Adds two scalar values (e.g., partial signatures).
 */

void ed25519_add_scalars(unsigned char *scalar_AB, const unsigned char *scalar_A, const unsigned char *scalar_B) {
    const unsigned char SC_1[32] = {1}; /* scalar with value 1 */
    sc_muladd(scalar_AB, SC_1, scalar_A, scalar_B);
}

/*
 * Picks a random scalar r and computes its commitment R = [r]B.
 */

int ed25519_create_commitment(unsigned char *secret_r, unsigned char *commitment_R, const unsigned char *randomness) {
    unsigned char r[64];
    ge_p3 R;

    // Decompress the 32 byte cryptographically secure random data to 64 byte.
    sha512(randomness, 32, r);
    sc_reduce(r);

    // Abort if secret equals 0 mod l or 1 mod l.
    if (!sc_valid_reduction(r)) {
        return 0;
    }

    // Compute the point [secret]B. Let the string R be the encoding of this point.
    ge_scalarmult_base(&R, r);
    ge_p3_tobytes(commitment_R, &R);

    // Copy secret.
    for (int i = 0; i < 32; ++i) {
        secret_r[i] = r[i];
    }

    return 1;
}
