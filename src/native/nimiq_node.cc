#include <nan.h>
extern "C" {
#include "nimiq_native.h"
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

NAN_METHOD(nimiq_argon2_target_async) {
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

NAN_MODULE_INIT(Init) {
  Set(target, New<String>("nimiq_argon2_target_async").ToLocalChecked(),
    GetFunction(New<FunctionTemplate>(nimiq_argon2_target_async)).ToLocalChecked());
}

NODE_MODULE(nimiq_node, Init)
