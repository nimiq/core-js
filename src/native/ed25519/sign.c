#include "ed25519.h"
#include "sha512.h"
#include "ge.h"
#include "sc.h"

/*
 * Computes a challenge c = H(R || A || M), where R is a commitment, A a public key and M a message.
 * Then it partially signs M by computing r + c*private_key, where r is the secret corresponding to R
 * and private_key the private key.
 *
 * In single-sig mode, r and R were constructed from the private key.
 * In multi-sig mode, R is the aggregated commitment, r the individual secret, and A the aggregated public key.
 *
 * - partial_signature contains the result of the signing.
 * - message corresponds to the message M to be signed.
 * - message_len corresponds to the length of the message.
 * - commitment_R corresponds to R.
 * - secret_r corresponds to the secret r.
 * - public_key corresponds to the private key.
 * - private_key corresponds to the private key.
 */
void ed25519_partial_sign(unsigned char *partial_signature, const unsigned char *message, size_t message_len, const unsigned char* commitment_R, const unsigned char *secret_r, const unsigned char *public_key, const unsigned char *private_key) {
    sha512_context hash;
    unsigned char hram[64];

    // c = H(R || A || M)
    sha512_init(&hash);
    sha512_update(&hash, commitment_R, 32);
    sha512_update(&hash, public_key, 32);
    sha512_update(&hash, message, message_len);
    sha512_final(&hash, hram);

    sc_reduce(hram);
    // r + c*private_key mod l
    sc_muladd(partial_signature, hram, private_key, secret_r);
}

void ed25519_sign(unsigned char *signature, const unsigned char *message, size_t message_len, const unsigned char *public_key, const unsigned char *private_key) {
    sha512_context hash;
    unsigned char az[64];
    unsigned char r[64];
    ge_p3 R;

    // decompress the 32 byte private key to 64 byte
    sha512(private_key, 32, az);
    az[0] &= 248;
    az[31] &= 63;
    az[31] |= 64;

    sha512_init(&hash);
    sha512_update(&hash, az + 32, 32);
    sha512_update(&hash, message, message_len);
    sha512_final(&hash, r);

    sc_reduce(r);
    ge_scalarmult_base(&R, r);
    ge_p3_tobytes(signature, &R);

    ed25519_partial_sign(signature + 32, message, message_len, signature, r, public_key, az);
}
