let port: SerialPort | null = null;
let writer: WritableStreamDefaultWriter | null = null;

export async function connectESP32() {

  port = await navigator.serial.requestPort();

  await port.open({
    baudRate: 115200
  });

  writer = port.writable!.getWriter();
}


export async function sendFrame(
  frame: Uint8Array
) {

  if (!writer) {
    throw new Error("ESP32 not connected");
  }

  const packet = new Uint8Array(
    2 + frame.length
  );

  packet[0] = 0xAA;
  packet[1] = 0x55;

  packet.set(frame, 2);

  await writer.write(packet);
}