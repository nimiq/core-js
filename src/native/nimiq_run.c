#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <sys/time.h>
#include "nimiq_native.h"

#define HARD_COUNT 100
#define LIGHT_COUNT 10000000

int main() {
    long start, end;
    struct timeval timecheck;
    char* out = malloc(32);
    char* in = strdup("Test1");

    gettimeofday(&timecheck, NULL);
    start = (long)timecheck.tv_sec * 1000 + (long)timecheck.tv_usec / 1000;

    for(int i = 0; i < HARD_COUNT; ++i) {
        nimiq_argon2(out, in, 5, 512);
        in[0]++;
    }

    gettimeofday(&timecheck, NULL);
    end = (long)timecheck.tv_sec * 1000 + (long)timecheck.tv_usec / 1000;
    printf("Hard(512 KiB) %ldms => %ld H/s\n", end-start, (HARD_COUNT*1000)/(end-start));
    start = end;

    for(int i = 0; i < HARD_COUNT; ++i) {
        nimiq_argon2(out, in, 5, 1024);
        in[0]++;
    }

    gettimeofday(&timecheck, NULL);
    end = (long)timecheck.tv_sec * 1000 + (long)timecheck.tv_usec / 1000;
    printf("Hard(1024 KiB) %ldms => %ld H/s\n", end-start, (HARD_COUNT*1000)/(end-start));
    start = end;

    for(int i = 0; i < LIGHT_COUNT; ++i) {
        nimiq_blake2(out, in, 5);
        in[0]++;
    }

    gettimeofday(&timecheck, NULL);
    end = (long)timecheck.tv_sec * 1000 + (long)timecheck.tv_usec / 1000;
    printf("Light %ldms => %ld kH/s\n", end-start, (LIGHT_COUNT)/(end-start));
    start = end;

    for(int i = 1; i < 4; ++i) {
        free(in);
        in = malloc(32);
        snprintf(in, 31, "Test1%d0000", i);
        uint32_t nonce = nimiq_argon2_target(out, in, strlen(in), 0x20000000u + (0xffff >> i), 0, (uint32_t)-1, 512);
    
        gettimeofday(&timecheck, NULL);
        end = (long)timecheck.tv_sec * 1000 + (long)timecheck.tv_usec / 1000;
        if (end-start == 0) end++;
        printf("Hard(%d) %ldms => (real: %ld H/s, observed: %ld H/s)\n", i, end-start, (1000 * nonce)/(end-start), (1000 << (i+8))/(end-start));
        start = end;
    }

    free(in);
    free(out);
    return 0;
}
