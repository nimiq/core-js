#include "ed25519.h"
#include "sha512.h"
#include "ge.h"

void ed25519_private_key_decompress(unsigned char *az, const unsigned char *private_key) {
    // decompress the 32 byte private key into 64 byte
    sha512(private_key, 32, az);

    az[0] &= 248;
    az[31] &= 63;
    az[31] |= 64;
}

void ed25519_public_key_derive(unsigned char *out_public_key, const unsigned char *private_key) {
    unsigned char az[64];
    ge_p3 A;

    ed25519_private_key_decompress(az, private_key);

    ge_scalarmult_base(&A,az);
    ge_p3_tobytes(out_public_key, &A);
}