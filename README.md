docker buildx build --platform linux/amd64 -f dockerfile -t owlix/tms:prod_linux --push .
docker buildx build --build-arg ENV_FILE=.env.prod -f dockerfile -t owlix/tms:prod_macos --push .
docker buildx build --build-arg ENV_FILE=.env.dev  -f dockerfile -t owlix/tms:dev --push .

Vừa refactor lại identity, cần rewire lại các import dependency để build
Server.ts không nên ôm quá nhiều về 2 worker, nó chỉ dùng cái mà 2 worker đó expose thôi. 
Hiện tại luồng cập nhập database sau khi sync như thế nào ? Sẽ có cái cập nhập là giữ luôn như cập nhập điểm danh, và có cái phải giữ đồng bộ liên tục với external như danh sách chuyên đề / guild / channel

docker buildx build --platform linux/amd64 --build-arg ENV_FILE=.env.dev  -f dockerfile -t owlix/tms:prod --push .