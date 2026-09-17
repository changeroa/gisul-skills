export function upload({ path }) { return { image_ref: `generated/${path.split('/').pop()}` }; }
