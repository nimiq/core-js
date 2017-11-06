// predefine some memory which can be accessed from javascript side withoud the need to malloc
#define STATIC_MEMORY_SIZE 4096
unsigned char static_memory[STATIC_MEMORY_SIZE];

unsigned char* get_static_memory_start() {
    return static_memory;
}

unsigned int get_static_memory_size() {
    return STATIC_MEMORY_SIZE;
}