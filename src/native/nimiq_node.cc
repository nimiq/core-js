#include <nan.h>
extern "C" {
#include "nimiq_native.h"
#include "ed25519/ed25519.h"
}

using v8::Function;
using v8::FunctionTemplate;
using v8::Handle;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Uint8Array;
using v8::Value;
using Nan::AsyncQueueWorker;
using Nan::AsyncWorker;
using Nan::Callback;
using Nan::GetFunction;
using Nan::HandleScope;
using Nan::New;
using Nan::Null;
using Nan::Set;
using Nan::To;

class MinerWorker : public AsyncWorker {
    public:
        MinerWorker(Callback* callback, void* in, uint32_t inlen, uint32_t compact, uint32_t min_nonce, uint32_t max_nonce, uint32_t m_cost)
            : AsyncWorker(callback), in(in), inlen(inlen), compact(compact), min_nonce(min_nonce), max_nonce(max_nonce), m_cost(m_cost), result_nonce(0) {}
        ~MinerWorker() {}

        void Execute() {
            result_nonce = nimiq_argon2_target(out, in, inlen, compact, min_nonce, max_nonce, m_cost);
        }

        void HandleOKCallback() {
            HandleScope scope;
            Local<Value> argv[] = {New<Number>(result_nonce)}; 
            callback->Call(1, argv);
        }

    private:
        uint8_t out[32];
        void* in;
        uint32_t inlen;
        uint32_t compact;
        uint32_t min_nonce;
        uint32_t max_nonce;
        uint32_t m_cost;
        uint32_t result_nonce;
};

class Argon2Worker : public AsyncWorker {
    public:
        Argon2Worker(Callback* callback, void* out, void* in, uint32_t inlen, uint32_t m_cost)
            : AsyncWorker(callback), out(out), in(in), inlen(inlen), m_cost(m_cost), res(0) {}
        ~Argon2Worker() {}

        void Execute()  {
            res = nimiq_argon2(out, in, inlen, m_cost);
        }

        void HandleOKCallback() {
            HandleScope scope;
            Local<Value> argv[] = {New<Number>(res)};
            callback->Call(1, argv);
        }

    private:
        void* out;
        void* in;
        uint32_t inlen;
        uint32_t m_cost;
        int res;
};

NAN_METHOD(node_argon2_target_async) {
    Callback* callback = new Callback(info[0].As<Function>());

    Local<Uint8Array> in_array = info[1].As<Uint8Array>();
    uint32_t inlen = in_array->Length();
    void* in = in_array->Buffer()->GetContents().Data();
 
    uint32_t compact = To<uint32_t>(info[2]).FromJust();
    uint32_t min_nonce = To<uint32_t>(info[3]).FromJust();
    uint32_t max_nonce = To<uint32_t>(info[4]).FromJust();
    uint32_t m_cost = To<uint32_t>(info[5]).FromJust();

    AsyncQueueWorker(new MinerWorker(callback, in, inlen, compact, min_nonce, max_nonce, m_cost));
}

NAN_METHOD(node_sha256) {
    Local<Uint8Array> out_array = info[0].As<Uint8Array>();
    Local<Uint8Array> in_array = info[1].As<Uint8Array>();
    uint32_t inlen = in_array->Length();
    void* out = out_array->Buffer()->GetContents().Data();
    void* in = in_array->Buffer()->GetContents().Data();
    nimiq_sha256(out, in, inlen);
}

NAN_METHOD(node_sha512) {
    Local<Uint8Array> out_array = info[0].As<Uint8Array>();
    Local<Uint8Array> in_array = info[1].As<Uint8Array>();
    uint32_t inlen = in_array->Length();
    void* out = out_array->Buffer()->GetContents().Data();
    void* in = in_array->Buffer()->GetContents().Data();
    nimiq_sha512(out, in, inlen);
}

NAN_METHOD(node_blake2) {
    Local<Uint8Array> out_array = info[0].As<Uint8Array>();
    Local<Uint8Array> in_array = info[1].As<Uint8Array>();
    uint32_t inlen = in_array->Length();
    void* out = out_array->Buffer()->GetContents().Data();
    void* in = in_array->Buffer()->GetContents().Data();
    nimiq_blake2(out, in, inlen);
}

NAN_METHOD(node_argon2) {
    Local<Uint8Array> out_array = info[0].As<Uint8Array>();
    Local<Uint8Array> in_array = info[1].As<Uint8Array>();
    uint32_t m_cost = To<uint32_t>(info[2]).FromJust();
    uint32_t inlen = in_array->Length();
    void* out = out_array->Buffer()->GetContents().Data();
    void* in = in_array->Buffer()->GetContents().Data();

    info.GetReturnValue().Set(New<Number>(nimiq_argon2(out, in, inlen, m_cost)));
}

NAN_METHOD(node_argon2_async) {
    Callback* callback = new Callback(info[0].As<Function>());

    Local<Uint8Array> out_array = info[1].As<Uint8Array>();
    Local<Uint8Array> in_array = info[2].As<Uint8Array>();
    uint32_t m_cost = To<uint32_t>(info[3]).FromJust();
    uint32_t inlen = in_array->Length();
    void* out = out_array->Buffer()->GetContents().Data();
    void* in = in_array->Buffer()->GetContents().Data();
    AsyncQueueWorker(new Argon2Worker(callback, out, in, inlen, m_cost));
}

NAN_METHOD(node_ed25519_public_key_derive) {
    Local<Uint8Array> out_array = info[0].As<Uint8Array>();
    Local<Uint8Array> in_array = info[1].As<Uint8Array>();
    uint8_t* out = (uint8_t*) out_array->Buffer()->GetContents().Data();
    uint8_t* in = (uint8_t*) in_array->Buffer()->GetContents().Data();

    ed25519_public_key_derive(out, in);
}

NAN_METHOD(node_ed25519_hash_public_keys) {
    Local<Uint8Array> out_array = info[0].As<Uint8Array>();
    Local<Uint8Array> in_array = info[1].As<Uint8Array>();
    uint32_t length = To<uint32_t>(info[2]).FromJust();
    uint8_t* out = (uint8_t*) out_array->Buffer()->GetContents().Data();
    uint8_t* in = (uint8_t*) in_array->Buffer()->GetContents().Data();

    ed25519_hash_public_keys(out, in, length);
}

NAN_METHOD(node_ed25519_delinearize_public_key) {
    Local<Uint8Array> out_array = info[0].As<Uint8Array>();
    Local<Uint8Array> hash_array = info[1].As<Uint8Array>();
    Local<Uint8Array> key_array = info[2].As<Uint8Array>();
    uint8_t* out = (uint8_t*) out_array->Buffer()->GetContents().Data();
    uint8_t* hash = (uint8_t*) hash_array->Buffer()->GetContents().Data();
    uint8_t* key = (uint8_t*) key_array->Buffer()->GetContents().Data();

    ed25519_delinearize_public_key(out, hash, key);
}

NAN_METHOD(node_ed25519_aggregate_delinearized_public_keys) {
    Local<Uint8Array> out_array = info[0].As<Uint8Array>();
    Local<Uint8Array> hash_array = info[1].As<Uint8Array>();
    Local<Uint8Array> keys_array = info[2].As<Uint8Array>();
    uint32_t length = To<uint32_t>(info[3]).FromJust();
    uint8_t* out = (uint8_t*) out_array->Buffer()->GetContents().Data();
    uint8_t* hash = (uint8_t*) hash_array->Buffer()->GetContents().Data();
    uint8_t* keys = (uint8_t*) keys_array->Buffer()->GetContents().Data();

    ed25519_aggregate_delinearized_public_keys(out, hash, keys, length);
}

NAN_METHOD(node_ed25519_add_scalars) {
    Local<Uint8Array> out_array = info[0].As<Uint8Array>();
    Local<Uint8Array> a_array = info[1].As<Uint8Array>();
    Local<Uint8Array> b_array = info[2].As<Uint8Array>();
    uint8_t* out = (uint8_t*) out_array->Buffer()->GetContents().Data();
    uint8_t* a = (uint8_t*) a_array->Buffer()->GetContents().Data();
    uint8_t* b = (uint8_t*) b_array->Buffer()->GetContents().Data();

    ed25519_add_scalars(out, a, b);
}

NAN_METHOD(node_ed25519_sign) {
    Local<Uint8Array> out_array = info[0].As<Uint8Array>();
    Local<Uint8Array> message_array = info[1].As<Uint8Array>();
    Local<Uint8Array> pubkey_array = info[2].As<Uint8Array>();
    Local<Uint8Array> privkey_array = info[3].As<Uint8Array>();
    uint8_t* out = (uint8_t*) out_array->Buffer()->GetContents().Data();
    uint8_t* message = (uint8_t*) message_array->Buffer()->GetContents().Data();
    uint32_t message_length = message_array->Length();
    uint8_t* pubkey = (uint8_t*) pubkey_array->Buffer()->GetContents().Data();
    uint8_t* privkey = (uint8_t*) privkey_array->Buffer()->GetContents().Data();

    ed25519_sign(out, message, message_length, pubkey, privkey);
}

NAN_METHOD(node_ed25519_verify) {
    Local<Uint8Array> signature_array = info[0].As<Uint8Array>();
    Local<Uint8Array> message_array = info[1].As<Uint8Array>();
    Local<Uint8Array> pubkey_array = info[2].As<Uint8Array>();
    uint8_t* signature = (uint8_t*) signature_array->Buffer()->GetContents().Data();
    uint8_t* message = (uint8_t*) message_array->Buffer()->GetContents().Data();
    uint32_t message_length = message_array->Length();
    uint8_t* pubkey = (uint8_t*) pubkey_array->Buffer()->GetContents().Data();

    info.GetReturnValue().Set(New<Number>(ed25519_verify(signature, message, message_length, pubkey)));
}

NAN_METHOD(node_kdf) {
    Local<Uint8Array> out_array = info[0].As<Uint8Array>();
    Local<Uint8Array> key_array = info[1].As<Uint8Array>();
    Local<Uint8Array> salt_array = info[2].As<Uint8Array>();
    uint32_t m_cost = To<uint32_t>(info[3]).FromJust();
    uint32_t iterations = To<uint32_t>(info[4]).FromJust();
    uint32_t keylen = key_array->Length();
    uint32_t saltlen = salt_array->Length();
    void* out = out_array->Buffer()->GetContents().Data();
    void* key = key_array->Buffer()->GetContents().Data();
    void* salt = salt_array->Buffer()->GetContents().Data();

    info.GetReturnValue().Set(New<Number>(nimiq_kdf(out, key, keylen, salt, saltlen, m_cost, iterations)));
}

NAN_METHOD(node_ed25519_aggregate_commitments) {
    Local<Uint8Array> out_array = info[0].As<Uint8Array>();
    Local<Uint8Array> in_array = info[1].As<Uint8Array>();
    uint32_t length = To<uint32_t>(info[2]).FromJust();
    uint8_t* out = (uint8_t*) out_array->Buffer()->GetContents().Data();
    uint8_t* in = (uint8_t*) in_array->Buffer()->GetContents().Data();

    ed25519_aggregate_commitments(out, in, length);
}

NAN_METHOD(node_ed25519_create_commitment) {
    Local<Uint8Array> out_secret_array = info[0].As<Uint8Array>();
    Local<Uint8Array> out_commitment_array = info[1].As<Uint8Array>();
    Local<Uint8Array> in_array = info[2].As<Uint8Array>();
    uint8_t* out_secret = (uint8_t*) out_secret_array->Buffer()->GetContents().Data();
    uint8_t* out_commitment = (uint8_t*) out_commitment_array->Buffer()->GetContents().Data();
    uint8_t* in = (uint8_t*) in_array->Buffer()->GetContents().Data();

    ed25519_create_commitment(out_secret, out_commitment, in);
}

NAN_METHOD(node_ed25519_derive_delinearized_private_key) {
    Local<Uint8Array> out_array = info[0].As<Uint8Array>();
    Local<Uint8Array> in_hash_array = info[1].As<Uint8Array>();
    Local<Uint8Array> in_public_array = info[2].As<Uint8Array>();
    Local<Uint8Array> in_private_array = info[3].As<Uint8Array>();
    uint8_t* out = (uint8_t*) out_array->Buffer()->GetContents().Data();
    uint8_t* in_hash = (uint8_t*) in_hash_array->Buffer()->GetContents().Data();
    uint8_t* in_public = (uint8_t*) in_public_array->Buffer()->GetContents().Data();
    uint8_t* in_private = (uint8_t*) in_private_array->Buffer()->GetContents().Data();

    ed25519_derive_delinearized_private_key(out, in_hash, in_public, in_private);
}

NAN_METHOD(node_ed25519_delinearized_partial_sign) {
    Local<Uint8Array> out_array = info[0].As<Uint8Array>();
    Local<Uint8Array> message_array = info[1].As<Uint8Array>();
    Local<Uint8Array> commitment_array = info[2].As<Uint8Array>();
    Local<Uint8Array> secret_array = info[3].As<Uint8Array>();
    Local<Uint8Array> keys_array = info[4].As<Uint8Array>();
    uint32_t keys_length = To<uint32_t>(info[5]).FromJust();
    Local<Uint8Array> pubkey_array = info[6].As<Uint8Array>();
    Local<Uint8Array> privkey_array = info[7].As<Uint8Array>();

    uint8_t* out = (uint8_t*) out_array->Buffer()->GetContents().Data();
    uint8_t* message = (uint8_t*) message_array->Buffer()->GetContents().Data();
    uint32_t message_length = message_array->Length();
    uint8_t* commitment = (uint8_t*) commitment_array->Buffer()->GetContents().Data();
    uint8_t* secret = (uint8_t*) secret_array->Buffer()->GetContents().Data();
    uint8_t* keys = (uint8_t*) keys_array->Buffer()->GetContents().Data();
    uint8_t* pubkey = (uint8_t*) pubkey_array->Buffer()->GetContents().Data();
    uint8_t* privkey = (uint8_t*) privkey_array->Buffer()->GetContents().Data();

    ed25519_delinearized_partial_sign(out, message, message_length, commitment, secret, keys, keys_length, pubkey, privkey);
}

NAN_MODULE_INIT(Init) {
    Set(target, New<String>("node_argon2_target_async").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_argon2_target_async)).ToLocalChecked());
    Set(target, New<String>("node_sha256").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_sha256)).ToLocalChecked());
    Set(target, New<String>("node_sha512").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_sha512)).ToLocalChecked());
    Set(target, New<String>("node_blake2").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_blake2)).ToLocalChecked());
    Set(target, New<String>("node_argon2").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_argon2)).ToLocalChecked());
    Set(target, New<String>("node_argon2_async").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_argon2_async)).ToLocalChecked());
    Set(target, New<String>("node_ed25519_public_key_derive").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_ed25519_public_key_derive)).ToLocalChecked());
    Set(target, New<String>("node_ed25519_hash_public_keys").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_ed25519_hash_public_keys)).ToLocalChecked());
    Set(target, New<String>("node_ed25519_delinearize_public_key").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_ed25519_delinearize_public_key)).ToLocalChecked());
    Set(target, New<String>("node_ed25519_aggregate_delinearized_public_keys").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_ed25519_aggregate_delinearized_public_keys)).ToLocalChecked());
    Set(target, New<String>("node_ed25519_add_scalars").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_ed25519_add_scalars)).ToLocalChecked());
    Set(target, New<String>("node_ed25519_sign").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_ed25519_sign)).ToLocalChecked());
    Set(target, New<String>("node_ed25519_verify").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_ed25519_verify)).ToLocalChecked());
    Set(target, New<String>("node_kdf").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_kdf)).ToLocalChecked());
    Set(target, New<String>("node_ed25519_aggregate_commitments").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_ed25519_aggregate_commitments)).ToLocalChecked());
    Set(target, New<String>("node_ed25519_create_commitment").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_ed25519_create_commitment)).ToLocalChecked());
    Set(target, New<String>("node_ed25519_derive_delinearized_private_key").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_ed25519_derive_delinearized_private_key)).ToLocalChecked());
    Set(target, New<String>("node_ed25519_delinearized_partial_sign").ToLocalChecked(),
        GetFunction(New<FunctionTemplate>(node_ed25519_delinearized_partial_sign)).ToLocalChecked());
}

NODE_MODULE(nimiq_node, Init)
