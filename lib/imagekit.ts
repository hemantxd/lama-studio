import ImageKit, {toFile} from "@imagekit/nodejs";

let client: InstanceType<typeof ImageKit>|null = null;


// this is the singleton pattern which is used to create a single instance of the ImageKit client
// so that you don't accidentally create multiple instances of the client
function getClient(){
    if(!_client) {
        _client = new ImageKit({
            privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
        });
        return _client;
    }
}

