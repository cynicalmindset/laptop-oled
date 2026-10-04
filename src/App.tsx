import { useRef, useState } from "react";
import {
  imageToOLED,
  type ConversionOptions,
} from "./oled/converter";
import {
  connectESP32,
  sendFrame,
} from "./oled/serial";

function App() {
  // -----------------------------
  // MEDIA
  // -----------------------------

  const [image, setImage] =
    useState<HTMLImageElement | null>(null);

  const [video, setVideo] =
    useState<string | null>(null);

  const [isVideo, setIsVideo] =
    useState(false);

  // -----------------------------
  // ESP32
  // -----------------------------

  const [connected, setConnected] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  // -----------------------------
  // IMAGE PROCESSING
  // -----------------------------

  const [brightness, setBrightness] =
    useState(0);

  const [contrast, setContrast] =
    useState(100);

  const [invert, setInvert] =
    useState(false);

  const [dither, setDither] =
    useState(true);

  // -----------------------------
  // TEXT
  // -----------------------------

  const [text, setText] =
    useState("");

  const [textSize, setTextSize] =
    useState(1);

  // -----------------------------
  // VIDEO REF
  // -----------------------------

  const videoRef =
    useRef<HTMLVideoElement>(null);


  // ==========================================
  // CONNECT ESP32
  // ==========================================

  async function handleConnect() {
    try {
      await connectESP32();

      setConnected(true);

    } catch (error) {

      console.error(error);

      alert("Failed to connect to ESP32");
    }
  }


  // ==========================================
  // FILE UPLOAD
  // ==========================================

  function handleFile(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;


    // --------------------------
    // VIDEO
    // --------------------------

    if (file.type.startsWith("video/")) {

      const url =
        URL.createObjectURL(file);

      setVideo(url);
      setIsVideo(true);
      setImage(null);

      return;
    }


    // --------------------------
    // IMAGE
    // --------------------------

    const img =
      new Image();

    img.onload = () => {

      setImage(img);

      setIsVideo(false);

      setVideo(null);
    };

    img.src =
      URL.createObjectURL(file);
  }


  // ==========================================
  // SEND IMAGE
  // ==========================================

  async function handleSendImage() {

    if (!image) return;

    if (!connected) {

      alert("Connect ESP32 first");

      return;
    }

    try {

      setSending(true);


      const options:
        ConversionOptions = {

        brightness,

        contrast,

        invert,

        dither,
      };


      const frame =
        imageToOLED(
          image,
          options
        );


      await sendFrame(frame);


      console.log(
        "Image sent to OLED"
      );

    } catch (error) {

      console.error(error);

      alert(
        "Failed to send image"
      );

    } finally {

      setSending(false);
    }
  }


  // ==========================================
  // TEXT → OLED FRAME
  // ==========================================

  async function handleSendText() {

    if (!connected) {

      alert("Connect ESP32 first");

      return;
    }

    if (!text.trim()) {

      alert("Enter some text");

      return;
    }


    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width = 128;

    canvas.height = 64;


    const ctx =
      canvas.getContext("2d");

    if (!ctx) return;


    // Black background

    ctx.fillStyle =
      "black";

    ctx.fillRect(
      0,
      0,
      128,
      64
    );


    // White text

    ctx.fillStyle =
      "white";

    ctx.font =
      `${8 * textSize}px monospace`;

    ctx.textBaseline =
      "top";


    // --------------------------
    // WORD WRAPPING
    // --------------------------

    const words =
      text.split(" ");

    let line = "";

    let y = 0;


    for (const word of words) {

      const testLine =
        line + word + " ";

      const width =
        ctx.measureText(
          testLine
        ).width;


      if (width > 128) {

        ctx.fillText(
          line,
          0,
          y
        );

        line =
          word + " ";

        y +=
          10 * textSize;

      } else {

        line =
          testLine;
      }


      if (y >= 64)
        break;
    }


    ctx.fillText(
      line,
      0,
      y
    );


    // --------------------------
    // CANVAS → PIXELS
    // --------------------------

    const pixels =
      ctx.getImageData(
        0,
        0,
        128,
        64
      ).data;


    const frame =
      new Uint8Array(1024);


    // --------------------------
    // PIXELS → OLED FORMAT
    // --------------------------

    for (
      let y = 0;
      y < 64;
      y++
    ) {

      for (
        let x = 0;
        x < 128;
        x++
      ) {

        const index =
          (y * 128 + x) * 4;


        const brightness =
          pixels[index];


        if (brightness > 128) {

          const byteIndex =
            Math.floor(
              (y * 128 + x) / 8
            );


          const bit =
            7 -
            ((y * 128 + x) % 8);


          frame[byteIndex] |=
            1 << bit;
        }
      }
    }


    try {

      setSending(true);

      await sendFrame(frame);

    } catch (error) {

      console.error(error);

      alert(
        "Failed to send text"
      );

    } finally {

      setSending(false);
    }
  }


  // ==========================================
  // VIDEO → OLED
  // ==========================================

  async function playVideoOnOLED(
    videoElement: HTMLVideoElement
  ) {

    if (!connected) {

      alert("Connect ESP32 first");

      return;
    }


    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width = 128;

    canvas.height = 64;


    const ctx =
      canvas.getContext("2d");

    if (!ctx) return;


    setSending(true);


    try {

      while (
        !videoElement.paused &&
        !videoElement.ended
      ) {

        // ------------------------
        // VIDEO → CANVAS
        // ------------------------

        ctx.drawImage(
          videoElement,
          0,
          0,
          128,
          64
        );


        // ------------------------
        // GET PIXELS
        // ------------------------

        const pixels =
          ctx.getImageData(
            0,
            0,
            128,
            64
          ).data;


        // ------------------------
        // CREATE FRAME
        // ------------------------

        const frame =
          new Uint8Array(1024);


        // ------------------------
        // CONVERT
        // ------------------------

        for (
          let y = 0;
          y < 64;
          y++
        ) {

          for (
            let x = 0;
            x < 128;
            x++
          ) {

            const index =
              (y * 128 + x) * 4;


            const r =
              pixels[index];

            const g =
              pixels[index + 1];

            const b =
              pixels[index + 2];


            const value =
              (
                r +
                g +
                b
              ) / 3;


            if (value > 128) {

              const byteIndex =
                Math.floor(
                  (y * 128 + x) / 8
                );


              const bit =
                7 -
                ((y * 128 + x) % 8);


              frame[byteIndex] |=
                1 << bit;
            }
          }
        }


        // ------------------------
        // SEND
        // ------------------------

        await sendFrame(
          frame
        );


        // ~10 FPS

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              100
            )
        );
      }

    } catch (error) {

      console.error(error);

    } finally {

      setSending(false);
    }
  }


  // ==========================================
  // UI
  // ==========================================

  return (

    <div
      style={{
        minHeight: "100vh",

        background:
          "#111",

        color:
          "white",

        padding:
          "40px",

        fontFamily:
          "Arial",
      }}
    >

      <h1>
        OLED Studio
      </h1>


      {/* ================================= */}
      {/* ESP32 CONNECTION */}
      {/* ================================= */}

      <button
        onClick={
          handleConnect
        }

        style={{
          padding:
            "10px 18px",

          cursor:
            "pointer",
        }}
      >

        {connected
          ? "ESP32 Connected"
          : "Connect ESP32"}

      </button>


      {/* ================================= */}
      {/* TEXT */}
      {/* ================================= */}

      <div
        style={{
          marginTop:
            "30px",

          marginBottom:
            "30px",
        }}
      >

        <h3>
          Text
        </h3>


        <textarea
          value={text}

          onChange={(e) =>
            setText(
              e.target.value
            )
          }

          placeholder=
            "Type something..."

          style={{
            width:
              "500px",

            height:
              "100px",

            background:
              "#222",

            color:
              "white",

            border:
              "1px solid #444",

            padding:
              "10px",

            fontSize:
              "18px",
          }}
        />


        <br />
        <br />


        <select
          value={
            textSize
          }

          onChange={(e) =>
            setTextSize(
              Number(
                e.target.value
              )
            )
          }
        >

          <option value={1}>
            Small
          </option>

          <option value={2}>
            Medium
          </option>

          <option value={3}>
            Large
          </option>

        </select>


        <br />
        <br />


        <button
          onClick={
            handleSendText
          }

          disabled={
            !connected ||
            !text.trim() ||
            sending
          }

          style={{
            padding:
              "10px 18px",

            cursor:
              "pointer",
          }}
        >

          Send Text to OLED

        </button>

      </div>


      {/* ================================= */}
      {/* FILE UPLOAD */}
      {/* ================================= */}

      <input
        type="file"

        accept="
          image/png,
          image/jpeg,
          image/webp,
          video/mp4,
          video/webm
        "

        onChange={
          handleFile
        }
      />


      {/* ================================= */}
      {/* IMAGE CONTROLS */}
      {/* ================================= */}

      {!isVideo &&
        image && (

        <div
          style={{
            marginTop:
              "25px",
          }}
        >

          <h3>
            Image Processing
          </h3>


          {/* BRIGHTNESS */}

          <div>

            <label>
              Brightness:{" "}
              {brightness}
            </label>

            <br />

            <input
              type="range"

              min="-100"

              max="100"

              value={
                brightness
              }

              onChange={(e) =>
                setBrightness(
                  Number(
                    e.target.value
                  )
                )
              }
            />

          </div>


          <br />


          {/* CONTRAST */}

          <div>

            <label>
              Contrast:{" "}
              {contrast}
            </label>

            <br />

            <input
              type="range"

              min="0"

              max="200"

              value={
                contrast
              }

              onChange={(e) =>
                setContrast(
                  Number(
                    e.target.value
                  )
                )
              }
            />

          </div>


          <br />


          {/* INVERT */}

          <label>

            <input
              type="checkbox"

              checked={
                invert
              }

              onChange={(e) =>
                setInvert(
                  e.target.checked
                )
              }
            />

            {" "}Invert

          </label>


          <br />
          <br />


          {/* DITHER */}

          <label>

            <input
              type="checkbox"

              checked={
                dither
              }

              onChange={(e) =>
                setDither(
                  e.target.checked
                )
              }
            />

            {" "}Dithering

          </label>

        </div>
      )}


      {/* ================================= */}
      {/* PREVIEW */}
      {/* ================================= */}

      <div
        style={{
          marginTop:
            "30px",
        }}
      >

        <h3>
          Preview
        </h3>


        <div
          style={{
            width:
              "512px",

            height:
              "256px",

            background:
              "black",

            border:
              "2px solid #444",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",
          }}
        >

          {/* IMAGE */}

          {!isVideo &&
            image && (

            <img
              src={
                image.src
              }

              style={{
                width:
                  "512px",

                height:
                  "256px",

                objectFit:
                  "fill",

                imageRendering:
                  "pixelated",
              }}
            />

          )}


          {/* VIDEO */}

          {isVideo &&
            video && (

            <video
              ref={
                videoRef
              }

              src={
                video
              }

              controls

              autoPlay

              loop

              muted

              style={{
                width:
                  "512px",

                height:
                  "256px",

                objectFit:
                  "contain",
              }}
            />

          )}


          {/* EMPTY */}

          {!image &&
            !video && (

            <span>
              No media selected
            </span>

          )}

        </div>

      </div>


      <br />


      {/* ================================= */}
      {/* IMAGE SEND */}
      {/* ================================= */}

      {!isVideo &&
        image && (

        <button
          onClick={
            handleSendImage
          }

          disabled={
            !connected ||
            sending
          }

          style={{
            padding:
              "12px 20px",

            cursor:
              "pointer",
          }}
        >

          {sending
            ? "Sending..."
            : "Send Image to OLED"}

        </button>

      )}


      {/* ================================= */}
      {/* VIDEO SEND */}
      {/* ================================= */}

      {isVideo &&
        video && (

        <button
          onClick={() => {

            if (
              videoRef.current
            ) {

              videoRef.current
                .currentTime = 0;

              videoRef.current
                .play();

              playVideoOnOLED(
                videoRef.current
              );
            }

          }}

          disabled={
            !connected ||
            sending
          }

          style={{
            padding:
              "12px 20px",

            cursor:
              "pointer",
          }}
        >

          {sending
            ? "Playing on OLED..."
            : "Play Video on OLED"}

        </button>

      )}

    </div>
  );
}

export default App;