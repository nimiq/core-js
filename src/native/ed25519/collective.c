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
 */

/*
 * Adds two points on a curve (e.g., public keys or commitments).
 */

void ed25519_add_points(unsigned char *point_AB, const unsigned char *point_A, const unsigned char *point_B) {
    ge_p1p1 AB_p1p1;
    ge_p3 AB;
    /* point A related */
    ge_p3 point_A_unpacked;
    ge_cached A;
    /* point B related */
    ge_p3 point_B_unpacked;
    ge_cached B;
    
    /* unpack point A into pA */
    ge_frombytes_negate_vartime(&point_A_unpacked, point_A);
    fe_neg(point_A_unpacked.X, point_A_unpacked.X); /* undo negate */
    fe_neg(point_A_unpacked.T, point_A_unpacked.T); /* undo negate */
    ge_p3_to_cached(&A, &point_A_unpacked);

    /* unpack point B into pB */
    ge_frombytes_negate_vartime(&point_B_unpacked, point_B);
    fe_neg(point_B_unpacked.X, point_B_unpacked.X); /* undo negate */
    fe_neg(point_B_unpacked.T, point_B_unpacked.T); /* undo negate */
    ge_p3_to_cached(&B, &point_B_unpacked);
    
    /* AB = A + B */
    ge_add(&AB_p1p1, &A, &B);
    ge_p1p1_to_p3(&AB, &AB_p1p1);

    /* pack point */
    ge_p3_tobytes(point_AB, &AB);
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
    ge_p3 R;

    // Decompress the 32 byte cryptographically secure random data to 64 byte.
    sha512(randomness, 32, secret_r);
    sc_reduce(secret_r);

    // Abort if secret equals 0 mod l or 1 mod l.
    if (!sc_valid_reduction(secret_r)) {
        return 0;
    }

    // Compute the point [secret]B. Let the string R be the encoding of this point.
    ge_scalarmult_base(&R, secret_r);
    ge_p3_tobytes(commitment_R, &R);

    return 1;
}
