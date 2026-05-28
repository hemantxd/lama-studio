import ImageKit, {toFile}  from "@imagekit/nodejs";


let _client: InstanceType<typeof ImageKit>|null = null;


// this is the singleton pattern which is used to create a single instance of the ImageKit client
// so that you don't accidentally create multiple instances of the client
function getClient(){
    if(!_client) {
        _client = new ImageKit({
            privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
        });
        
    }
    return _client;
}

export async function uploadBufferToImagekit(
  params: {
    buffer: Buffer;
    fileName: string;
    folder: string;
    mimetype: string;
  }
) {
    const client = getClient()!;
    const file = await toFile(params.buffer, params.fileName, {type: params.mimetype});

    const result = await client.files.upload({
        file: file,
        fileName: params.fileName,
        folder: params.folder,
        useUniqueFileName: true,
    });

    return {
        url: result.url!,
        fileId: result.fileId!,
    };
}
