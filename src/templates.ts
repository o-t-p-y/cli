export interface GeneratedFile {
  path: string;
  content: string;
}

export function generateNextAppTemplates(hasSrc: boolean, isTs: boolean): GeneratedFile[] {
  const prefix = hasSrc ? "src/" : "";
  const ext = isTs ? "ts" : "js";

  const clientCode = isTs
    ? `import { OtpyClient } from "otpy";

export const otpy = new OtpyClient({
  apiKey: process.env.OTPY_API_KEY!,
});
`
    : `import { OtpyClient } from "otpy";

export const otpy = new OtpyClient({
  apiKey: process.env.OTPY_API_KEY,
});
`;

  const sendRouteCode = isTs
    ? `import { NextResponse } from "next/server";
import { otpy } from "@/lib/otpy";

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    if (!phone) {
      return NextResponse.json({ error: "شماره موبایل الزامی است" }, { status: 400 });
    }

    const result = await otpy.sendOtp(phone);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "خطا در ارسال پیامک" },
      { status: error.status || 500 }
    );
  }
}
`
    : `import { NextResponse } from "next/server";
import { otpy } from "@/lib/otpy";

export async function POST(request) {
  try {
    const { phone } = await request.json();
    if (!phone) {
      return NextResponse.json({ error: "شماره موبایل الزامی است" }, { status: 400 });
    }

    const result = await otpy.sendOtp(phone);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "خطا در ارسال پیامک" },
      { status: error.status || 500 }
    );
  }
}
`;

  const verifyRouteCode = isTs
    ? `import { NextResponse } from "next/server";
import { otpy } from "@/lib/otpy";

export async function POST(request: Request) {
  try {
    const { phone, code } = await request.json();
    if (!phone || !code) {
      return NextResponse.json({ error: "شماره موبایل و کد ورود الزامی است" }, { status: 400 });
    }

    const result = await otpy.verifyOtp(phone, code);
    if (!result.verified) {
      return NextResponse.json({ verified: false, error: "کد وارد شده اشتباه یا منقضی است" }, { status: 401 });
    }

    // TODO: احراز هویت موفق بود. اینجا سشن یا توکن لاگین کاربر را صادر کنید.
    return NextResponse.json({ verified: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "خطا در بررسی کد" },
      { status: error.status || 500 }
    );
  }
}
`
    : `import { NextResponse } from "next/server";
import { otpy } from "@/lib/otpy";

export async function POST(request) {
  try {
    const { phone, code } = await request.json();
    if (!phone || !code) {
      return NextResponse.json({ error: "شماره موبایل و کد ورود الزامی است" }, { status: 400 });
    }

    const result = await otpy.verifyOtp(phone, code);
    if (!result.verified) {
      return NextResponse.json({ verified: false, error: "کد وارد شده اشتباه یا منقضی است" }, { status: 401 });
    }

    // TODO: احراز هویت موفق بود. اینجا سشن یا توکن لاگین کاربر را صادر کنید.
    return NextResponse.json({ verified: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "خطا در بررسی کد" },
      { status: error.status || 500 }
    );
  }
}
`;

  return [
    { path: `${prefix}lib/otpy.${ext}`, content: clientCode },
    { path: `${prefix}app/api/auth/otp/send/route.${ext}`, content: sendRouteCode },
    { path: `${prefix}app/api/auth/otp/verify/route.${ext}`, content: verifyRouteCode },
  ];
}

export function generateSvelteKitTemplates(): GeneratedFile[] {
  const clientCode = `import { OtpyClient } from "otpy";
import { env } from "$env/dynamic/private";

export const otpy = new OtpyClient({
  apiKey: env.OTPY_API_KEY ?? "",
});
`;

  const sendRouteCode = `import { json, type RequestHandler } from "@sveltejs/kit";
import { OtpyError } from "otpy";
import { otpy } from "$lib/otpy";

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { phone } = (await request.json()) as { phone?: string };
    if (!phone) {
      return json({ error: "شماره موبایل الزامی است" }, { status: 400 });
    }

    const result = await otpy.sendOtp(phone);
    return json(result);
  } catch (error) {
    if (error instanceof OtpyError) {
      return json({ error: error.code }, { status: error.status || 500 });
    }
    return json({ error: "خطا در ارسال پیامک" }, { status: 500 });
  }
};
`;

  const verifyRouteCode = `import { json, type RequestHandler } from "@sveltejs/kit";
import { OtpyError } from "otpy";
import { otpy } from "$lib/otpy";

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { phone, code } = (await request.json()) as { phone?: string; code?: string };
    if (!phone || !code) {
      return json({ error: "شماره موبایل و کد ورود الزامی است" }, { status: 400 });
    }

    const result = await otpy.verifyOtp(phone, code);
    if (!result.verified) {
      return json({ verified: false, error: "کد وارد شده اشتباه یا منقضی است" }, { status: 401 });
    }

    // TODO: احراز هویت موفق بود. اینجا سشن یا توکن لاگین کاربر را صادر کنید.
    return json({ verified: true });
  } catch (error) {
    if (error instanceof OtpyError) {
      return json({ error: error.code }, { status: error.status || 500 });
    }
    return json({ error: "خطا در بررسی کد" }, { status: 500 });
  }
};
`;

  return [
    { path: "src/lib/otpy.ts", content: clientCode },
    { path: "src/routes/auth/otp/send/+server.ts", content: sendRouteCode },
    { path: "src/routes/auth/otp/verify/+server.ts", content: verifyRouteCode },
  ];
}

export function generateExpressTemplates(hasSrc: boolean, isTs: boolean): GeneratedFile[] {
  const prefix = hasSrc ? "src/" : "";
  const ext = isTs ? "ts" : "js";

  const clientCode = `import { OtpyClient } from "otpy";

export const otpy = new OtpyClient({
  apiKey: process.env.OTPY_API_KEY || "",
});
`;

  const routerCode = `import { Router } from "express";
import { otpy } from "../lib/otpy.js";

const router = Router();

router.post("/send", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "شماره موبایل الزامی است" });
    const result = await otpy.sendOtp(phone);
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.code || "خطا در ارسال" });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: "شماره موبایل و کد الزامی است" });
    const result = await otpy.verifyOtp(phone, code);
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.code || "خطا در تایید" });
  }
});

export default router;
`;

  return [
    { path: `${prefix}lib/otpy.${ext}`, content: clientCode },
    { path: `${prefix}routes/otp.${ext}`, content: routerCode },
  ];
}

export function generatePythonFastApiTemplates(): GeneratedFile[] {
  const code = `print("Install dependencies: pip install requests fastapi")

import os
import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth/otp", tags=["OTP"])

OTPY_API_KEY = os.getenv("OTPY_API_KEY", "")
HEADERS = {
    "Authorization": f"Bearer {OTPY_API_KEY}",
    "Content-Type": "application/json"
}

class SendOtpRequest(BaseModel):
    phone: str

class VerifyOtpRequest(BaseModel):
    phone: str
    code: str

@router.post("/send")
def send_otp(req: SendOtpRequest):
    res = requests.post("https://api.otpy.ir/v1/otp/send", json={"phone": req.phone}, headers=HEADERS)
    if not res.ok:
        raise HTTPException(status_code=res.status_code, detail=res.json().get("error", "Failed"))
    return res.json()

@router.post("/verify")
def verify_otp(req: VerifyOtpRequest):
    res = requests.post("https://api.otpy.ir/v1/otp/verify", json={"phone": req.phone, "code": req.code}, headers=HEADERS)
    if not res.ok:
        raise HTTPException(status_code=res.status_code, detail=res.json().get("error", "Failed"))
    return res.json()
`;

  return [{ path: "routers/otp.py", content: code }];
}

export function generateGoTemplates(): GeneratedFile[] {
  const code = `package otpy

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type OtpClient struct {
	ApiKey  string
	BaseUrl string
}

func NewClient() *OtpClient {
	return &OtpClient{
		ApiKey:  os.Getenv("OTPY_API_KEY"),
		BaseUrl: "https://api.otpy.ir",
	}
}

func (c *OtpClient) Send(phone string) (map[string]any, error) {
	payload, _ := json.Marshal(map[string]string{"phone": phone})
	req, _ := http.NewRequest("POST", c.BaseUrl+"/v1/otp/send", bytes.NewBuffer(payload))
	req.Header.Set("Authorization", "Bearer "+c.ApiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]any
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}
`;

  return [{ path: "pkg/otpy/client.go", content: code }];
}
