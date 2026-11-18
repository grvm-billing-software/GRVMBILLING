import os
import re
import logging
import uuid
import urllib.parse
from contextlib import suppress
from datetime import datetime, timezone, timedelta, date
from pathlib import Path
from typing import List, Optional, Literal
import asyncio
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query, UploadFile, File, Form
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, ConfigDict
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
APP_PASSWORD = os.environ["APP_PASSWORD"]
HOSPITAL_NAME = os.environ["HOSPITAL_NAME"]
HOSPITAL_ADDRESS = os.environ["HOSPITAL_ADDRESS"]
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "grvm-hospital"
DEFAULT_CHARGES = ["OPD / Consultation Charge", "Bed / Room Charge", "Nursing Charge"]
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(), "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 404:
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(True), "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> bytes:
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage()}, timeout=60)
    if resp.status_code == 404:
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(True)}, timeout=60)
    resp.raise_for_status()
    return resp.content
HOSPITAL_WHATSAPP = os.environ.get("HOSPITAL_WHATSAPP", "")

client = AsyncIOMotorClient(MONGO_URL)#
db = client[DB_NAME]

app = FastAPI(title="GRVM Hospital Billing API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hospital")


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


IST = ZoneInfo("Asia/Kolkata")


def ist_today() -> date:
    return datetime.now(IST).date()


def ist_start(d: date) -> str:
    return datetime(d.year, d.month, d.day, tzinfo=IST).astimezone(timezone.utc).isoformat()


async def get_cfg() -> dict:
    doc = await db.settings.find_one({"_id": "main"}) or {}
    return {
        "hospitalName": doc.get("hospitalName") or HOSPITAL_NAME,
        "hospitalAddress": doc.get("hospitalAddress") or HOSPITAL_ADDRESS,
        "hospitalWhatsapp": doc.get("hospitalWhatsapp", HOSPITAL_WHATSAPP),
        "defaultOpdFee": doc.get("defaultOpdFee", 300),
        "defaultCharges": doc.get("defaultCharges", DEFAULT_CHARGES),
    }


def new_id() -> str:
    return str(uuid.uuid4())


def strip_id(doc):
    if doc is None:
        return None
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


# ----- Models -----
class LoginBody(BaseModel):
    password: str


class SessionInfo(BaseModel):
    authenticated: bool
    user: Optional[dict] = None


class Medicine(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    name: str
    batchNumber: str
    dispatchDate: Optional[str] = None
    receiveDate: Optional[str] = None
    expiryDate: str
    quantity: int = 0
    sellingCost: float
    mrp: float
    tabletsPerStrip: int = 0
    supplier: str = ""
    location: str = ""
    notes: str = ""
    createdAt: str = Field(default_factory=lambda: iso(now()))


class MedicineCreate(BaseModel):
    name: str
    batchNumber: str
    dispatchDate: Optional[str] = None
    receiveDate: Optional[str] = None
    expiryDate: str
    quantity: int = 0
    sellingCost: float
    mrp: float
    tabletsPerStrip: int = 0
    supplier: str = ""
    location: str = ""
    notes: str = ""


class Patient(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    name: str
    age: int
    gender: str
    contact: str = ""
    address: str = ""
    language: str = "hi"  # hi or en
    createdAt: str = Field(default_factory=lambda: iso(now()))


class PatientCreate(BaseModel):
    name: str
    age: int
    gender: str
    contact: str = ""
    address: str = ""
    language: str = "hi"


class OPDVisit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    appointmentNumber: str = ""
    patientId: Optional[str] = None
    patientName: str
    age: int
    gender: str
    contact: str = ""
    doctor: str = ""
    defaultFee: float = 300.0
    fee: float = 0
    notes: str = ""
    visitDate: str


class OPDCreate(BaseModel):
    patientId: Optional[str] = None
    patientName: str
    age: int
    gender: str
    contact: str = ""
    doctor: str = ""
    fee: float
    notes: str = ""
    visitDate: Optional[str] = None


class IPDAdmission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    patientId: Optional[str] = None
    patientName: str
    patientContact: str = ""
    admissionAt: str
    dischargeAt: Optional[str] = None
    room: str = ""
    doctor: str = ""
    reason: str = ""
    status: str = "admitted"
    dischargeSummary: str = ""
    revisitDate: Optional[str] = None


class IPDCreate(BaseModel):
    patientId: Optional[str] = None
    patientName: str
    patientContact: str = ""
    admissionAt: Optional[str] = None
    room: str = ""
    doctor: str = ""
    reason: str = ""


class IPDUpdate(BaseModel):
    patientName: Optional[str] = None
    patientContact: Optional[str] = None
    admissionAt: Optional[str] = None
    dischargeAt: Optional[str] = None
    room: Optional[str] = None
    doctor: Optional[str] = None
    reason: Optional[str] = None
    status: Optional[str] = None
    dischargeSummary: Optional[str] = None
    revisitDate: Optional[str] = None


class Referral(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    patientId: Optional[str] = None
    patientName: str
    patientContact: str = ""
    referringDoctor: str = ""
    center: str = ""
    testName: str = ""
    notes: str = ""
    referralDate: str
    status: str = "pending"


class ReferralCreate(BaseModel):
    patientId: Optional[str] = None
    patientName: str
    patientContact: str = ""
    referringDoctor: str = ""
    center: str = ""
    testName: str = ""
    notes: str = ""
    referralDate: str


class BillLine(BaseModel):
    medicineId: str
    medicineName: str
    batchNumber: str = ""
    quantity: int
    unitPrice: float
    lineTotal: float = 0
    expiryDate: str = ""
    mrp: float = 0


class Charge(BaseModel):
    label: str
    amount: float = 0


class Bill(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    invoiceNumber: str = ""
    patientId: Optional[str] = None
    patientName: str
    patientContact: str = ""
    invoiceDate: str = Field(default_factory=lambda: iso(now()))
    lines: List[BillLine] = []
    charges: List[Charge] = []
    chargesTotal: float = 0
    description: str = ""
    medicineSubtotal: float = 0
    opdFee: float = 0
    ipdFee: float = 0
    labFee: float = 0
    discount: float = 0
    total: float = 0
    notes: str = ""
    status: str = "active"
    cancelledAt: Optional[str] = None
    cancelReason: str = ""


class BillCreate(BaseModel):
    patientId: Optional[str] = None
    patientName: str
    patientContact: str = ""
    lines: List[BillLine] = []
    charges: List[Charge] = []
    description: str = ""
    ipdItemIds: List[str] = []
    opdFee: float = 0
    ipdFee: float = 0
    labFee: float = 0
    discount: float = 0
    notes: str = ""


class Staff(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    name: str
    designation: str = ""
    phone: str = ""
    joiningDate: str
    monthlySalary: float = 0
    createdAt: str = Field(default_factory=lambda: iso(now()))


class StaffCreate(BaseModel):
    name: str
    designation: str = ""
    phone: str = ""
    joiningDate: str
    monthlySalary: float = 0


class Attendance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    staffId: str
    staffName: str
    date: str
    status: str  # present/absent/leave


class AttendanceCreate(BaseModel):
    staffId: str
    staffName: str
    date: str
    status: str


class WhatsAppMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    patientId: Optional[str] = None
    patientName: str = ""
    toNumber: str
    body: str
    category: str  # opd_register, discharge_summary, referral, revisit_reminder, invoice
    status: str = "queued"  # queued, sent, failed, scheduled
    scheduledFor: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: iso(now()))
    sentAt: Optional[str] = None
    waLink: str = ""
    error: str = ""
    refId: Optional[str] = None


async def next_seq(name: str) -> int:
    doc = await db.counters.find_one_and_update({"_id": name}, {"$inc": {"seq": 1}}, upsert=True, return_document=True)
    return doc["seq"]


def clean_patch(body: dict) -> dict:
    return {k: v for k, v in body.items() if k not in ("id", "_id")}


# ----- Auth dependency -----
async def auth_check(request: Request):
    token = request.headers.get("x-session-token") or request.cookies.get(
        "session_token"
    )
    sess = await db.sessions.find_one({"token": token or "", "expiresAt": {"$gt": iso(now())}}) if token else None
    if not sess:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"id": "admin", "name": "GRVM Admin", "role": "admin"}


# ----- WhatsApp helpers -----
def build_wa_link(number: str, body: str) -> str:
    digits = "".join(ch for ch in (number or "") if ch.isdigit())
    if digits and not digits.startswith("91") and len(digits) == 10:
        digits = "91" + digits
    text = urllib.parse.quote(body)
    return f"https://wa.me/{digits}?text={text}" if digits else ""


async def queue_whatsapp(
    *,
    to_number: str,
    body: str,
    category: str,
    patient_id: Optional[str] = None,
    patient_name: str = "",
    scheduled_for: Optional[datetime] = None,
    ref_id: Optional[str] = None,
) -> WhatsAppMessage:
    msg = WhatsAppMessage(
        refId=ref_id,
        patientId=patient_id,
        patientName=patient_name,
        toNumber=to_number or "",
        body=body,
        category=category,
        status="scheduled" if scheduled_for else "queued",
        scheduledFor=iso(scheduled_for) if scheduled_for else None,
        waLink=build_wa_link(to_number or "", body),
    )
    await db.whatsapp_messages.insert_one(msg.model_dump())
    return msg


def bilingual_revisit_body(patient_name: str, revisit_date: str) -> str:
    return (
        f"🏥 {HOSPITAL_NAME}\n\n"
        f"नमस्ते {patient_name} 🙏\n"
        f"कृपया अपनी पुनर्जांच (फॉलो-अप) के लिए *{revisit_date}* को आएँ।\n"
        f"📍 पता: {HOSPITAL_ADDRESS}\n\n"
        f"Hello {patient_name},\n"
        f"Please visit us for your follow-up on *{revisit_date}*.\n"
        f"📍 Address: {HOSPITAL_ADDRESS}\n\n"
        f"💙 Get well soon!"
    )


def opd_register_body(patient_name: str, appt: str, fee: float, doctor: str) -> str:
    return (
        f"🏥 {HOSPITAL_NAME}\n\n"
        f"नमस्ते {patient_name} 🙏\n"
        f"आपका OPD पंजीकरण सफल रहा।\n"
        f"🎫 OPD नंबर: *{appt}*\n"
        f"👨‍⚕️ डॉक्टर: {doctor or '—'}\n"
        f"💰 शुल्क: ₹{fee:.2f}\n"
        f"📍 {HOSPITAL_ADDRESS}\n\n"
        f"Hello {patient_name}, your OPD registration is confirmed.\n"
        f"OPD No: *{appt}* | Doctor: {doctor or '—'} | Fee: ₹{fee:.2f}"
    )


def discharge_body(patient_name: str, summary: str, revisit: Optional[str]) -> str:
    rev = f"\n🗓️ अगली जांच / Follow-up: *{revisit}*" if revisit else ""
    return (
        f"🏥 {HOSPITAL_NAME} — डिस्चार्ज सारांश\n\n"
        f"मरीज़/Patient: {patient_name}\n\n"
        f"📝 Summary:\n{summary}\n{rev}\n\n"
        f"📍 {HOSPITAL_ADDRESS}\n💙 Take care!"
    )


def referral_body(patient_name: str, referring_doctor: str, center: str, test_name: str) -> str:
    return (
        f"🏥 {HOSPITAL_NAME} — रेफ़रल सूचना\n\n"
        f"मरीज़/Patient: {patient_name}\n"
        f"👨‍⚕️ Referred by: {referring_doctor or '—'}\n"
        f"🏨 Refer to / केंद्र: {center or '—'}\n"
        f"🧪 Test/Service: {test_name or '—'}\n\n"
        f"कृपया जल्द से जल्द संपर्क करें।\n"
        f"Please visit at the earliest.\n📍 {HOSPITAL_ADDRESS}"
    )


def invoice_body(patient_name: str, invoice_no: str, total: float) -> str:
    return (
        f"🏥 {HOSPITAL_NAME}\n\n"
        f"नमस्ते {patient_name} 🙏\n"
        f"आपका बिल तैयार है / Your invoice is ready.\n"
        f"🧾 Invoice: *{invoice_no}*\n"
        f"💰 Total: ₹{total:.2f}\n"
        f"📍 {HOSPITAL_ADDRESS}\n💙 धन्यवाद / Thank you!"
    )


# ----- Routes: auth -----
@api.get("/")
async def root():
    return {"name": "GRVM Hospital Billing API", "version": "1.0"}


@api.post("/auth/login")
async def login(body: LoginBody):
    if body.password != APP_PASSWORD:
        return JSONResponse(
            status_code=401,
            content={"authenticated": False, "success": False, "message": "Galat password. Please try again."},
        )
    token = uuid.uuid4().hex + uuid.uuid4().hex
    await db.sessions.insert_one({"token": token, "createdAt": iso(now()), "expiresAt": iso(now() + timedelta(days=7))})
    resp = JSONResponse(
        {"authenticated": True, "success": True, "token": token, "user": {"id": "admin", "name": "GRVM Admin", "role": "admin"}}
    )
    return resp


@api.get("/auth/session")
async def session(request: Request):
    token = request.headers.get("x-session-token") or request.cookies.get("session_token")
    if token and await db.sessions.find_one({"token": token, "expiresAt": {"$gt": iso(now())}}):
        return {"authenticated": True, "user": {"id": "admin", "name": "GRVM Admin", "role": "admin"}}
    return {"authenticated": False, "user": None}


@api.post("/auth/logout")
async def logout(request: Request):
    await db.sessions.delete_one({"token": request.headers.get("x-session-token", "")})
    return {"success": True}


# ----- Settings -----
class SettingsUpdate(BaseModel):
    hospitalName: str
    hospitalAddress: str
    hospitalWhatsapp: str = ""
    defaultOpdFee: float = Field(ge=0)
    defaultCharges: List[str] = []


@api.get("/settings", dependencies=[Depends(auth_check)])
async def get_settings():
    return await get_cfg()


async def refresh_cfg_globals():
    global HOSPITAL_NAME, HOSPITAL_ADDRESS
    cfg = await get_cfg()
    HOSPITAL_NAME, HOSPITAL_ADDRESS = cfg["hospitalName"], cfg["hospitalAddress"]


@api.put("/settings", dependencies=[Depends(auth_check)])
async def update_settings(body: SettingsUpdate):
    data = body.model_dump()
    data["defaultCharges"] = [c.strip() for c in data["defaultCharges"] if c.strip()]
    if not data["hospitalName"].strip() or not data["hospitalAddress"].strip():
        raise HTTPException(400, "Hospital name and address are required")
    await db.settings.update_one({"_id": "main"}, {"$set": data}, upsert=True)
    await refresh_cfg_globals()
    return await get_cfg()


@api.get("/followups/today", dependencies=[Depends(auth_check)])
async def followups_today():
    t = ist_today().isoformat()
    ipd = await db.ipd_admissions.find({"revisitDate": t}, {"_id": 0}).to_list(500)
    opd = await db.opd_visits.find({"revisitDate": t}, {"_id": 0}).to_list(500)
    rows = [{"kind": "ipd", "id": a["id"], "patientId": a.get("patientId"), "patientName": a["patientName"], "patientContact": a.get("patientContact", ""),
             "doctor": a.get("doctor", ""), "reason": a.get("reason", ""), "revisitDate": a["revisitDate"], "called": a.get("followupCalled", False)} for a in ipd]
    rows += [{"kind": "opd", "id": v["id"], "patientId": v.get("patientId"), "patientName": v["patientName"], "patientContact": v.get("contact", ""),
              "doctor": v.get("doctor", ""), "reason": f"OPD No. {v.get('appointmentNumber', '')}", "revisitDate": v["revisitDate"], "called": v.get("followupCalled", False)} for v in opd]
    return sorted(rows, key=lambda x: x["patientName"].lower())


@api.post("/followups/{kind}/{aid}/called", dependencies=[Depends(auth_check)])
async def followup_called(kind: Literal["ipd", "opd"], aid: str, body: dict):
    col = db.ipd_admissions if kind == "ipd" else db.opd_visits
    r = await col.update_one({"id": aid}, {"$set": {"followupCalled": bool(body.get("called", True))}})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"success": True}


# ----- Dashboard -----
@api.get("/dashboard", dependencies=[Depends(auth_check)])
async def dashboard():
    td = ist_today()
    today_str = td.isoformat()
    sixty = (td + timedelta(days=60)).isoformat()
    meds = await db.medicines.find({}, {"_id": 0}).to_list(10000)
    admitted = await db.ipd_admissions.count_documents({"status": "admitted"})
    opd_today = await db.opd_visits.count_documents({"visitDate": {"$gte": ist_start(td), "$lt": ist_start(td + timedelta(days=1))}})
    bills = await db.bills.find({"invoiceDate": {"$gte": ist_start(td.replace(day=1))}, "status": {"$ne": "cancelled"}}, {"_id": 0, "total": 1}).to_list(5000)
    recent = await db.bills.find({}, {"_id": 0}).sort("invoiceDate", -1).to_list(5)
    due_today = await db.ipd_admissions.count_documents({"revisitDate": today_str}) + await db.opd_visits.count_documents({"revisitDate": today_str})
    return {
        "medicineCount": len(meds),
        "lowStockCount": sum(1 for m in meds if (m.get("quantity") or 0) < 10),
        "nearExpiryCount": sum(1 for m in meds if today_str <= (m.get("expiryDate") or "") <= sixty),
        "expiredCount": sum(1 for m in meds if (m.get("expiryDate") or "") < today_str),
        "admittedCount": admitted,
        "todayOpdCount": opd_today,
        "dueTodayCount": due_today,
        "monthlyBilling": round(sum(b.get("total", 0) for b in bills), 2),
        "recentBills": recent,
    }


# ----- Medicines -----
@api.get("/medicines", dependencies=[Depends(auth_check)])
async def list_medicines(search: str = "", stock: str = "all", expiry: str = "all"):
    q = {}
    if search:
        q["$or"] = [{"name": {"$regex": re.escape(search.strip()), "$options": "i"}}, {"batchNumber": {"$regex": re.escape(search.strip()), "$options": "i"}}, {"supplier": {"$regex": re.escape(search.strip()), "$options": "i"}}]
    today_str = ist_today().isoformat()
    if stock == "low":
        q["quantity"] = {"$lt": 10}
    elif stock == "available":
        q["quantity"] = {"$gt": 0}
    if expiry == "expired":
        q["expiryDate"] = {"$lt": today_str}
    elif expiry == "near":
        q["expiryDate"] = {"$gte": today_str, "$lte": (ist_today() + timedelta(days=60)).isoformat()}
    return await db.medicines.find(q, {"_id": 0}).sort("name", 1).collation({"locale": "en", "strength": 2}).to_list(1000)


@api.post("/medicines", dependencies=[Depends(auth_check)])
async def create_medicine(body: MedicineCreate):
    m = Medicine(**body.model_dump())
    await db.medicines.insert_one(m.model_dump())
    await db.inventory_logs.insert_one({
        "id": new_id(), "medicineId": m.id, "medicineName": m.name, "batchNumber": m.batchNumber,
        "action": "created", "quantityChange": m.quantity, "quantityBefore": 0, "quantityAfter": m.quantity,
        "createdAt": iso(now()), "notes": "Initial entry",
    })
    return m.model_dump()


@api.patch("/medicines/{mid}", dependencies=[Depends(auth_check)])
async def update_medicine(mid: str, body: dict):
    existing = await db.medicines.find_one({"id": mid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Medicine not found")
    before = existing.get("quantity", 0)
    body = clean_patch(body)
    await db.medicines.update_one({"id": mid}, {"$set": body})
    updated = await db.medicines.find_one({"id": mid}, {"_id": 0})
    if "quantity" in body and body["quantity"] != before:
        await db.inventory_logs.insert_one({
            "id": new_id(), "medicineId": mid, "medicineName": updated["name"], "batchNumber": updated["batchNumber"],
            "action": "adjustment", "quantityChange": body["quantity"] - before, "quantityBefore": before, "quantityAfter": body["quantity"],
            "createdAt": iso(now()), "notes": "Manual adjustment",
        })
    return updated


@api.delete("/medicines/{mid}", dependencies=[Depends(auth_check)])
async def delete_medicine(mid: str):
    res = await db.medicines.delete_one({"id": mid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Medicine not found")
    return {"success": True}


@api.get("/inventory-logs", dependencies=[Depends(auth_check)])
async def inventory_logs(limit: int = 100):
    return await db.inventory_logs.find({}, {"_id": 0}).sort("createdAt", -1).to_list(limit)


class FamilyDispatchCreate(BaseModel):
    memberName: str
    medicineId: str
    quantity: int = Field(gt=0)
    date: Optional[str] = None
    givenBy: str = ""
    notes: str = ""


@api.get("/family-dispatches", dependencies=[Depends(auth_check)])
async def list_family(search: str = ""):
    q = {}
    if search.strip():
        pat = {"$regex": re.escape(search.strip()), "$options": "i"}
        q["$or"] = [{"memberName": pat}, {"medicineName": pat}, {"givenBy": pat}]
    return await db.family_dispatches.find(q, {"_id": 0}).sort([("date", -1), ("createdAt", -1)]).to_list(1000)


@api.post("/family-dispatches", dependencies=[Depends(auth_check)])
async def create_family(body: FamilyDispatchCreate):
    if not body.memberName.strip() or not body.givenBy.strip():
        raise HTTPException(400, "Member name and given by are required")
    d = (body.date or ist_today().isoformat())[:10]
    try:
        date.fromisoformat(d)
    except ValueError:
        raise HTTPException(400, "Invalid date")
    med = await db.medicines.find_one_and_update({"id": body.medicineId, "quantity": {"$gte": body.quantity}}, {"$inc": {"quantity": -body.quantity}}, return_document=True)
    if not med:
        raise HTTPException(409, "Medicine not found or not enough stock")
    rec = {"id": new_id(), "memberName": body.memberName.strip(), "medicineId": med["id"], "medicineName": med["name"], "batchNumber": med["batchNumber"],
           "quantity": body.quantity, "date": d, "givenBy": body.givenBy.strip(), "notes": body.notes.strip(), "createdAt": iso(now())}
    await db.family_dispatches.insert_one(dict(rec))
    await db.inventory_logs.insert_one({
        "id": new_id(), "medicineId": med["id"], "medicineName": med["name"], "batchNumber": med["batchNumber"], "action": "family",
        "quantityChange": -body.quantity, "quantityBefore": med["quantity"] + body.quantity, "quantityAfter": med["quantity"],
        "createdAt": iso(now()), "notes": f"Given to family member {rec['memberName']} by {rec['givenBy']}"})
    return rec


@api.delete("/family-dispatches/{fid}", dependencies=[Depends(auth_check)])
async def delete_family(fid: str):
    rec = await db.family_dispatches.find_one_and_delete({"id": fid})
    if not rec:
        raise HTTPException(404, "Record not found")
    med = await db.medicines.find_one_and_update({"id": rec["medicineId"]}, {"$inc": {"quantity": rec["quantity"]}}, return_document=True)
    if med:
        await db.inventory_logs.insert_one({
            "id": new_id(), "medicineId": med["id"], "medicineName": med["name"], "batchNumber": med["batchNumber"], "action": "returned",
            "quantityChange": rec["quantity"], "quantityBefore": med["quantity"] - rec["quantity"], "quantityAfter": med["quantity"],
            "createdAt": iso(now()), "notes": f"Family dispatch to {rec['memberName']} removed"})
    return {"success": True}


# ----- Patients -----
@api.get("/patients", dependencies=[Depends(auth_check)])
async def list_patients(search: str = ""):
    q = {}
    if search.strip():
        pat = {"$regex": re.escape(search.strip()), "$options": "i"}
        ids = [v["patientId"] async for v in db.opd_visits.find({"appointmentNumber": search.strip()}, {"patientId": 1}) if v.get("patientId")]
        q["$or"] = [{"name": pat}, {"contact": pat}, {"id": {"$in": ids}}]
    rows = await db.patients.find(q, {"_id": 0}).sort("name", 1).collation({"locale": "en", "strength": 2}).to_list(500)
    pids = [p["id"] for p in rows]
    last = {d["_id"]: d["last"] async for d in db.opd_visits.aggregate([
        {"$match": {"patientId": {"$in": pids}}}, {"$sort": {"visitDate": -1}},
        {"$group": {"_id": "$patientId", "last": {"$first": {"visitDate": "$visitDate", "appointmentNumber": "$appointmentNumber"}}}}])}
    admitted = set(await db.ipd_admissions.distinct("patientId", {"patientId": {"$in": pids}, "status": "admitted"}))
    for p in rows:
        p["lastVisit"] = last.get(p["id"])
        p["admitted"] = p["id"] in admitted
    return rows


@api.post("/patients", dependencies=[Depends(auth_check)])
async def create_patient(body: PatientCreate):
    p = Patient(**body.model_dump())
    await db.patients.insert_one(p.model_dump())
    return p.model_dump()


@api.get("/patients/{pid}", dependencies=[Depends(auth_check)])
async def get_patient(pid: str):
    p = await db.patients.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Patient not found")
    opd = await db.opd_visits.find({"patientId": pid}, {"_id": 0}).sort("visitDate", -1).to_list(50)
    ipd = await db.ipd_admissions.find({"patientId": pid}, {"_id": 0}).sort("admissionAt", -1).to_list(50)
    bills = await db.bills.find({"patientId": pid}, {"_id": 0}).sort("invoiceDate", -1).to_list(50)
    refs = await db.referrals.find({"patientId": pid}, {"_id": 0}).sort("referralDate", -1).to_list(50)
    notes = await db.patient_notes.find({"patientId": pid, "isDeleted": False}, {"_id": 0}).sort([("date", -1), ("createdAt", -1)]).to_list(500)
    items = await db.ipd_items.find({"patientId": pid}, {"_id": 0}).sort("date", -1).to_list(2000)
    return {"patient": p, "opd": opd, "ipd": ipd, "bills": bills, "referrals": refs, "notes": notes, "ipdItems": items}


class PatientUpdate(BaseModel):
    name: str
    age: int = Field(ge=0, le=130)
    gender: str = ""
    contact: str = ""
    address: str = ""


@api.patch("/patients/{pid}", dependencies=[Depends(auth_check)])
async def update_patient(pid: str, body: PatientUpdate):
    if not body.name.strip():
        raise HTTPException(400, "Name is required")
    r = await db.patients.update_one({"id": pid}, {"$set": {**body.model_dump(), "name": body.name.strip()}})
    if r.matched_count == 0:
        raise HTTPException(404, "Patient not found")
    name, contact = body.name.strip(), body.contact
    await db.opd_visits.update_many({"patientId": pid}, {"$set": {"patientName": name, "contact": contact, "age": body.age, "gender": body.gender}})
    await db.ipd_admissions.update_many({"patientId": pid}, {"$set": {"patientName": name, "patientContact": contact}})
    async for m in db.whatsapp_messages.find({"patientId": pid, "status": {"$in": ["queued", "scheduled"]}}, {"_id": 0, "id": 1, "body": 1}):
        await db.whatsapp_messages.update_one({"id": m["id"]}, {"$set": {"toNumber": contact, "patientName": name, "waLink": build_wa_link(contact, m["body"])}})
    return await db.patients.find_one({"id": pid}, {"_id": 0})


class DischargeBody(BaseModel):
    summary: str
    revisitDate: str


def parse_revisit(value: str) -> datetime:
    try:
        d = date.fromisoformat(value[:10])
    except ValueError:
        raise HTTPException(400, "Invalid revisit date")
    return datetime(d.year, d.month, d.day, 9, 0, tzinfo=IST).astimezone(timezone.utc)


async def schedule_revisit(ref_id: str, contact: str, patient_id: Optional[str], name: str, revisit: str):
    await db.whatsapp_messages.delete_many({"refId": ref_id, "category": "revisit_reminder", "status": "scheduled"})
    if contact:
        await queue_whatsapp(to_number=contact, body=bilingual_revisit_body(name, revisit), category="revisit_reminder",
                             patient_id=patient_id, patient_name=name, scheduled_for=parse_revisit(revisit), ref_id=ref_id)


@api.post("/patients/{pid}/discharge", dependencies=[Depends(auth_check)])
async def discharge_patient(pid: str, body: DischargeBody):
    p = await db.patients.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Patient not found")
    if not body.summary.strip() or not body.revisitDate:
        raise HTTPException(400, "Discharge summary and revisit date are required")
    parse_revisit(body.revisitDate)
    adm = await db.ipd_admissions.find_one({"patientId": pid, "status": "admitted"}, {"_id": 0}, sort=[("admissionAt", -1)])
    if adm:
        updated = await update_ipd(adm["id"], IPDUpdate(status="discharged", dischargeSummary=body.summary.strip(), revisitDate=body.revisitDate[:10]))
        return {"type": "ipd", "record": updated}
    visit = await db.opd_visits.find_one({"patientId": pid}, {"_id": 0}, sort=[("visitDate", -1)])
    if not visit:
        raise HTTPException(400, "Patient has no OPD visit or IPD admission to discharge")
    upd = {"dischargeSummary": body.summary.strip(), "revisitDate": body.revisitDate[:10], "dischargedAt": iso(now()), "followupCalled": False}
    await db.opd_visits.update_one({"id": visit["id"]}, {"$set": upd})
    contact = visit.get("contact") or p.get("contact", "")
    await schedule_revisit(visit["id"], contact, pid, visit["patientName"], upd["revisitDate"])
    if contact:
        await queue_whatsapp(to_number=contact, body=discharge_body(visit["patientName"], upd["dischargeSummary"], upd["revisitDate"]),
                             category="discharge_summary", patient_id=pid, patient_name=visit["patientName"])
    return {"type": "opd", "record": {**visit, **upd}}


class IPDItemCreate(BaseModel):
    medicineId: Optional[str] = None
    name: str = ""
    quantity: int = Field(default=1, gt=0)
    unitPrice: float = Field(default=0, ge=0)
    date: Optional[str] = None
    notes: str = ""


@api.post("/ipd-admissions/{aid}/items", dependencies=[Depends(auth_check)])
async def add_ipd_item(aid: str, body: IPDItemCreate):
    adm = await db.ipd_admissions.find_one({"id": aid}, {"_id": 0})
    if not adm:
        raise HTTPException(404, "IPD admission not found")
    item = {"id": new_id(), "admissionId": aid, "patientId": adm.get("patientId"), "medicineId": body.medicineId, "batchNumber": "",
            "name": body.name.strip(), "quantity": body.quantity, "unitPrice": body.unitPrice, "amount": round(body.quantity * body.unitPrice, 2),
            "date": (body.date or ist_today().isoformat())[:10], "notes": body.notes.strip(), "billed": False, "billId": None, "createdAt": iso(now())}
    if body.medicineId:
        med = await db.medicines.find_one_and_update({"id": body.medicineId, "quantity": {"$gte": body.quantity}}, {"$inc": {"quantity": -body.quantity}}, return_document=True)
        if not med:
            raise HTTPException(409, "Medicine not found or not enough stock")
        item["name"], item["batchNumber"] = med["name"], med["batchNumber"]
        await db.inventory_logs.insert_one({
            "id": new_id(), "medicineId": med["id"], "medicineName": med["name"], "batchNumber": med["batchNumber"], "action": "ipd_use",
            "quantityChange": -body.quantity, "quantityBefore": med["quantity"] + body.quantity, "quantityAfter": med["quantity"],
            "createdAt": iso(now()), "notes": f"Used for IPD patient {adm['patientName']}"})
    if not item["name"]:
        raise HTTPException(400, "Item name is required")
    await db.ipd_items.insert_one(dict(item))
    return item


@api.delete("/ipd-admissions/{aid}/items/{iid}", dependencies=[Depends(auth_check)])
async def delete_ipd_item(aid: str, iid: str):
    item = await db.ipd_items.find_one({"id": iid, "admissionId": aid}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Item not found")
    if item.get("billed"):
        raise HTTPException(400, "This item is already on an invoice; cancel the invoice first")
    await db.ipd_items.delete_one({"id": iid})
    if item.get("medicineId"):
        med = await db.medicines.find_one_and_update({"id": item["medicineId"]}, {"$inc": {"quantity": item["quantity"]}}, return_document=True)
        if med:
            await db.inventory_logs.insert_one({
                "id": new_id(), "medicineId": med["id"], "medicineName": med["name"], "batchNumber": med["batchNumber"], "action": "returned",
                "quantityChange": item["quantity"], "quantityBefore": med["quantity"] - item["quantity"], "quantityAfter": med["quantity"],
                "createdAt": iso(now()), "notes": "IPD item removed"})
    return {"success": True}


IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic"}


@api.post("/patients/{pid}/notes", dependencies=[Depends(auth_check)])
async def add_patient_note(pid: str, date: str = Form(...), description: str = Form(""), files: List[UploadFile] = File(default=[])):
    if not await db.patients.find_one({"id": pid}, {"_id": 1}):
        raise HTTPException(404, "Patient not found")
    try:
        datetime.fromisoformat(date[:10])
    except ValueError:
        raise HTTPException(400, "Invalid date")
    if not description.strip() and not files:
        raise HTTPException(400, "Add a description or a photo")
    photos = []
    for f in files:
        if f.content_type not in IMAGE_TYPES:
            raise HTTPException(400, f"{f.filename} is not a photo")
        data = await f.read()
        if len(data) > 10 * 1024 * 1024:
            raise HTTPException(400, f"{f.filename} is larger than 10 MB")
        fid = new_id()
        res = await asyncio.to_thread(put_object, f"{APP_NAME}/patients/{pid}/{fid}.{IMAGE_TYPES[f.content_type]}", data, f.content_type)
        await db.files.insert_one({"id": fid, "path": res["path"], "contentType": f.content_type, "filename": f.filename, "patientId": pid, "isDeleted": False, "createdAt": iso(now())})
        photos.append({"id": fid, "filename": f.filename})
    note = {"id": new_id(), "patientId": pid, "date": date[:10], "description": description.strip(), "photos": photos, "isDeleted": False, "createdAt": iso(now())}
    await db.patient_notes.insert_one(dict(note))
    return note


@api.delete("/patients/{pid}/notes/{nid}", dependencies=[Depends(auth_check)])
async def delete_patient_note(pid: str, nid: str):
    r = await db.patient_notes.update_one({"id": nid, "patientId": pid}, {"$set": {"isDeleted": True}})
    if r.matched_count == 0:
        raise HTTPException(404, "Note not found")
    return {"success": True}


@api.get("/files/{fid}", dependencies=[Depends(auth_check)])
async def get_file(fid: str):
    rec = await db.files.find_one({"id": fid, "isDeleted": False})
    if not rec:
        raise HTTPException(404, "File not found")
    data = await asyncio.to_thread(get_object, rec["path"])
    return Response(content=data, media_type=rec["contentType"])


# ----- OPD -----
@api.get("/opd-visits", dependencies=[Depends(auth_check)])
async def list_opd(search: str = "", day: str = ""):
    q = {}
    if day:
        try:
            d = date.fromisoformat(day)
        except ValueError:
            raise HTTPException(400, "Invalid date")
        q["visitDate"] = {"$gte": ist_start(d), "$lt": ist_start(d + timedelta(days=1))}
    if search:
        q["$or"] = [{"patientName": {"$regex": re.escape(search.strip()), "$options": "i"}}, {"appointmentNumber": {"$regex": re.escape(search.strip()), "$options": "i"}}, {"doctor": {"$regex": re.escape(search.strip()), "$options": "i"}}, {"contact": {"$regex": re.escape(search.strip()), "$options": "i"}}]
    return await db.opd_visits.find(q, {"_id": 0}).sort("visitDate", -1).to_list(500)


@api.post("/opd-visits", dependencies=[Depends(auth_check)])
async def create_opd(body: OPDCreate):
    if not body.patientName.strip() or body.age < 0 or body.fee < 0:
        raise HTTPException(400, "Check name, age and fee")
    digits = "".join(ch for ch in body.contact if ch.isdigit())
    if not (len(digits) == 10 or (len(digits) == 12 and digits.startswith("91"))):
        raise HTTPException(400, "Enter a valid 10-digit mobile number")
    patient_id = body.patientId
    if not patient_id:
        existing = await db.patients.find_one({"name": body.patientName, "contact": body.contact or ""}, {"_id": 0})
        if existing:
            patient_id = existing["id"]
        else:
            p = Patient(name=body.patientName, age=body.age, gender=body.gender, contact=body.contact)
            await db.patients.insert_one(p.model_dump())
            patient_id = p.id
    seq = await next_seq(f"opd_{ist_today().isoformat()}")
    visit = OPDVisit(
        appointmentNumber=str(seq),
        patientId=patient_id,
        patientName=body.patientName,
        age=body.age,
        gender=body.gender,
        contact=body.contact,
        doctor=body.doctor,
        fee=body.fee,
        notes=body.notes,
        visitDate=body.visitDate or iso(now()),
    )
    await db.opd_visits.insert_one(visit.model_dump())
    if body.contact:
        await queue_whatsapp(
            to_number=body.contact,
            body=opd_register_body(body.patientName, visit.appointmentNumber, body.fee, body.doctor),
            category="opd_register",
            patient_id=patient_id,
            patient_name=body.patientName,
        )
    return visit.model_dump()


@api.patch("/opd-visits/{vid}", dependencies=[Depends(auth_check)])
async def update_opd(vid: str, body: dict):
    r = await db.opd_visits.update_one({"id": vid}, {"$set": clean_patch(body)})
    if r.matched_count == 0:
        raise HTTPException(404, "OPD visit not found")
    return await db.opd_visits.find_one({"id": vid}, {"_id": 0})


@api.delete("/opd-visits/{vid}", dependencies=[Depends(auth_check)])
async def delete_opd(vid: str):
    r = await db.opd_visits.delete_one({"id": vid})
    if r.deleted_count == 0:
        raise HTTPException(404, "OPD visit not found")
    return {"success": True}


# ----- IPD -----
@api.get("/ipd-admissions", dependencies=[Depends(auth_check)])
async def list_ipd(search: str = "", status: str = "all"):
    q = {}
    if search:
        q["$or"] = [{"patientName": {"$regex": re.escape(search.strip()), "$options": "i"}}, {"doctor": {"$regex": re.escape(search.strip()), "$options": "i"}}, {"room": {"$regex": re.escape(search.strip()), "$options": "i"}}]
    if status != "all":
        q["status"] = status
    return await db.ipd_admissions.find(q, {"_id": 0}).sort("admissionAt", -1).to_list(500)


@api.post("/ipd-admissions", dependencies=[Depends(auth_check)])
async def create_ipd(body: IPDCreate):
    if not body.patientName.strip():
        raise HTTPException(400, "Patient name is required")
    if not body.patientId:
        found = await db.patients.find_one({"name": body.patientName, "contact": body.patientContact or ""}, {"_id": 0})
        if found:
            body.patientId = found["id"]
        else:
            p = Patient(name=body.patientName, age=0, gender="", contact=body.patientContact)
            await db.patients.insert_one(p.model_dump())
            body.patientId = p.id
    adm = IPDAdmission(
        patientId=body.patientId,
        patientName=body.patientName,
        patientContact=body.patientContact,
        admissionAt=body.admissionAt or iso(now()),
        room=body.room,
        doctor=body.doctor,
        reason=body.reason,
    )
    await db.ipd_admissions.insert_one(adm.model_dump())
    return adm.model_dump()


@api.patch("/ipd-admissions/{aid}", dependencies=[Depends(auth_check)])
async def update_ipd(aid: str, body: IPDUpdate):
    existing = await db.ipd_admissions.find_one({"id": aid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "IPD admission not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates.get("revisitDate"):
        parse_revisit(updates["revisitDate"])
        updates["revisitDate"] = updates["revisitDate"][:10]
        updates["followupCalled"] = False
    if updates.get("status") == "discharged" and existing.get("status") != "discharged":
        if not (updates.get("dischargeSummary") or "").strip() or not updates.get("revisitDate"):
            raise HTTPException(400, "Discharge summary and revisit date are required")
    if updates.get("status") == "discharged" and "dischargeAt" not in updates:
        updates["dischargeAt"] = iso(now())
    await db.ipd_admissions.update_one({"id": aid}, {"$set": updates})
    updated = await db.ipd_admissions.find_one({"id": aid}, {"_id": 0})
    # if revisit scheduled, queue WA at that date at 09:00 local-ish
    if updates.get("revisitDate"):
        await schedule_revisit(aid, existing.get("patientContact", ""), existing.get("patientId"), existing.get("patientName", ""), updates["revisitDate"][:10])
    if updates.get("status") == "discharged" and (updates.get("dischargeSummary") or existing.get("dischargeSummary")):
        contact = existing.get("patientContact", "")
        if contact:
            summary = updates.get("dischargeSummary") or existing.get("dischargeSummary", "")
            await queue_whatsapp(
                to_number=contact,
                body=discharge_body(existing["patientName"], summary, updates.get("revisitDate") or existing.get("revisitDate")),
                category="discharge_summary",
                patient_id=existing.get("patientId"),
                patient_name=existing.get("patientName", ""),
            )
    return updated


@api.delete("/ipd-admissions/{aid}", dependencies=[Depends(auth_check)])
async def delete_ipd(aid: str):
    if await db.ipd_items.find_one({"admissionId": aid, "billed": True}, {"_id": 1}):
        raise HTTPException(400, "This admission has items on an invoice; cancel the invoice first")
    async for item in db.ipd_items.find({"admissionId": aid}, {"_id": 0}):
        if item.get("medicineId"):
            med = await db.medicines.find_one_and_update({"id": item["medicineId"]}, {"$inc": {"quantity": item["quantity"]}}, return_document=True)
            if med:
                await db.inventory_logs.insert_one({
                    "id": new_id(), "medicineId": med["id"], "medicineName": med["name"], "batchNumber": med["batchNumber"], "action": "returned",
                    "quantityChange": item["quantity"], "quantityBefore": med["quantity"] - item["quantity"], "quantityAfter": med["quantity"],
                    "createdAt": iso(now()), "notes": "IPD admission deleted"})
    await db.ipd_items.delete_many({"admissionId": aid})
    await db.whatsapp_messages.delete_many({"refId": aid, "status": "scheduled"})
    r = await db.ipd_admissions.delete_one({"id": aid})
    if r.deleted_count == 0:
        raise HTTPException(404, "IPD admission not found")
    return {"success": True}


# ----- Referrals -----
@api.get("/referrals", dependencies=[Depends(auth_check)])
async def list_referrals(search: str = "", status: str = "all"):
    q = {}
    if search:
        q["$or"] = [{"patientName": {"$regex": re.escape(search.strip()), "$options": "i"}}, {"center": {"$regex": re.escape(search.strip()), "$options": "i"}}, {"referringDoctor": {"$regex": re.escape(search.strip()), "$options": "i"}}]
    if status != "all":
        q["status"] = status
    return await db.referrals.find(q, {"_id": 0}).sort("referralDate", -1).to_list(500)


@api.post("/referrals", dependencies=[Depends(auth_check)])
async def create_referral(body: ReferralCreate):
    r = Referral(**body.model_dump())
    await db.referrals.insert_one(r.model_dump())
    if body.patientContact:
        await queue_whatsapp(
            to_number=body.patientContact,
            body=referral_body(body.patientName, body.referringDoctor, body.center, body.testName),
            category="referral",
            patient_id=body.patientId,
            patient_name=body.patientName,
        )
    return r.model_dump()


@api.patch("/referrals/{rid}", dependencies=[Depends(auth_check)])
async def update_referral(rid: str, body: dict):
    r = await db.referrals.update_one({"id": rid}, {"$set": clean_patch(body)})
    if r.matched_count == 0:
        raise HTTPException(404, "Referral not found")
    return await db.referrals.find_one({"id": rid}, {"_id": 0})


@api.delete("/referrals/{rid}", dependencies=[Depends(auth_check)])
async def delete_referral(rid: str):
    r = await db.referrals.delete_one({"id": rid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Referral not found")
    return {"success": True}


# ----- Bills / Invoices -----
@api.get("/bills", dependencies=[Depends(auth_check)])
async def list_bills(search: str = ""):
    q = {}
    if search:
        q["$or"] = [{"invoiceNumber": {"$regex": re.escape(search.strip()), "$options": "i"}}, {"patientName": {"$regex": re.escape(search.strip()), "$options": "i"}}, {"patientContact": {"$regex": re.escape(search.strip()), "$options": "i"}}]
    return await db.bills.find(q, {"_id": 0}).sort("invoiceDate", -1).to_list(500)


@api.post("/bills", dependencies=[Depends(auth_check)])
async def create_bill(body: BillCreate):
    if any(l.quantity <= 0 or l.unitPrice < 0 for l in body.lines):
        raise HTTPException(400, "Quantity must be positive")
    charges = [c for c in body.charges if c.label.strip() and c.amount]
    if min([body.opdFee, body.ipdFee, body.labFee, body.discount] + [c.amount for c in charges]) < 0:
        raise HTTPException(400, "Fees cannot be negative")
    charges_total = round(sum(c.amount for c in charges), 2)
    if not body.lines and body.opdFee + body.ipdFee + body.labFee + charges_total <= 0:
        raise HTTPException(400, "Invoice is empty")
    # Validate stock & deduct
    for line in body.lines:
        med = await db.medicines.find_one({"id": line.medicineId}, {"_id": 0})
        if not med:
            raise HTTPException(404, f"Medicine {line.medicineId} missing")
        if (med.get("quantity") or 0) < line.quantity:
            raise HTTPException(409, f"Insufficient stock for {med['name']}")
        line.medicineName, line.batchNumber = med["name"], med["batchNumber"]
        line.expiryDate, line.mrp = med.get("expiryDate", ""), med.get("mrp", 0)
    med_subtotal = round(sum(l.quantity * l.unitPrice for l in body.lines), 2)
    gross = med_subtotal + charges_total + body.opdFee + body.ipdFee + body.labFee
    if body.discount > gross:
        raise HTTPException(400, "Discount exceeds invoice amount")
    total = round(gross - body.discount, 2)
    seq = await next_seq("bill")
    bill = Bill(
        invoiceNumber=f"INV-{1000 + seq:05d}",
        patientId=body.patientId,
        patientName=body.patientName,
        patientContact=body.patientContact,
        lines=[BillLine(**{**l.model_dump(), "lineTotal": round(l.quantity * l.unitPrice, 2)}) for l in body.lines],
        charges=charges,
        chargesTotal=charges_total,
        description=body.description.strip(),
        medicineSubtotal=med_subtotal,
        opdFee=body.opdFee,
        ipdFee=body.ipdFee,
        labFee=body.labFee,
        discount=body.discount,
        total=total,
        notes=body.notes,
    )
    done = []
    for line in bill.lines:
        med = await db.medicines.find_one_and_update(
            {"id": line.medicineId, "quantity": {"$gte": line.quantity}}, {"$inc": {"quantity": -line.quantity}})
        if not med:
            for mid, q in done:
                await db.medicines.update_one({"id": mid}, {"$inc": {"quantity": q}})
            raise HTTPException(409, f"Insufficient stock for {line.medicineName}")
        done.append((line.medicineId, line.quantity))
    await db.bills.insert_one(bill.model_dump())
    if body.ipdItemIds:
        await db.ipd_items.update_many({"id": {"$in": body.ipdItemIds}, "billed": False}, {"$set": {"billed": True, "billId": bill.id}})
    for line in bill.lines:
        after = (await db.medicines.find_one({"id": line.medicineId}, {"quantity": 1}))["quantity"]
        before = after + line.quantity
        await db.inventory_logs.insert_one({
            "id": new_id(), "medicineId": line.medicineId, "medicineName": line.medicineName, "batchNumber": line.batchNumber,
            "action": "sale", "quantityChange": -line.quantity, "quantityBefore": before, "quantityAfter": after,
            "billId": bill.id, "createdAt": iso(now()), "notes": f"Invoice {bill.invoiceNumber}",
        })
    if body.patientContact:
        await queue_whatsapp(
            to_number=body.patientContact,
            body=invoice_body(body.patientName, bill.invoiceNumber, total),
            category="invoice",
            patient_id=body.patientId,
            patient_name=body.patientName,
        )
    return bill.model_dump()


@api.post("/bills/{bid}/cancel", dependencies=[Depends(auth_check)])
async def cancel_bill(bid: str, body: dict = None):
    bill = await db.bills.find_one_and_update(
        {"id": bid, "status": {"$ne": "cancelled"}},
        {"$set": {"status": "cancelled", "cancelledAt": iso(now()), "cancelReason": (body or {}).get("reason", "")}})
    if not bill:
        raise HTTPException(404, "Invoice not found or already cancelled")
    await db.ipd_items.update_many({"billId": bid}, {"$set": {"billed": False, "billId": None}})
    for line in bill.get("lines", []):
        med = await db.medicines.find_one_and_update({"id": line["medicineId"]}, {"$inc": {"quantity": line["quantity"]}}, return_document=True)
        if med:
            await db.inventory_logs.insert_one({
                "id": new_id(), "medicineId": line["medicineId"], "medicineName": line["medicineName"], "batchNumber": line.get("batchNumber", ""),
                "action": "returned", "quantityChange": line["quantity"], "quantityBefore": med["quantity"] - line["quantity"], "quantityAfter": med["quantity"],
                "billId": bid, "createdAt": iso(now()), "notes": f"Invoice {bill['invoiceNumber']} cancelled",
            })
    return await db.bills.find_one({"id": bid}, {"_id": 0})


@api.get("/bills/{bid}", dependencies=[Depends(auth_check)])
async def get_bill(bid: str):
    b = await db.bills.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Invoice not found")
    return b


# ----- Staff / Attendance -----
@api.get("/staff", dependencies=[Depends(auth_check)])
async def list_staff():
    return await db.staff.find({}, {"_id": 0}).sort("name", 1).to_list(500)


@api.post("/staff", dependencies=[Depends(auth_check)])
async def create_staff(body: StaffCreate):
    s = Staff(**body.model_dump())
    await db.staff.insert_one(s.model_dump())
    return s.model_dump()


@api.patch("/staff/{sid}", dependencies=[Depends(auth_check)])
async def update_staff(sid: str, body: dict):
    r = await db.staff.update_one({"id": sid}, {"$set": clean_patch(body)})
    if r.matched_count == 0:
        raise HTTPException(404, "Staff not found")
    return await db.staff.find_one({"id": sid}, {"_id": 0})


@api.delete("/staff/{sid}", dependencies=[Depends(auth_check)])
async def delete_staff(sid: str):
    r = await db.staff.delete_one({"id": sid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Staff not found")
    return {"success": True}


@api.get("/attendance", dependencies=[Depends(auth_check)])
async def list_attendance(date: Optional[str] = None):
    q = {"date": date} if date else {}
    return await db.attendance.find(q, {"_id": 0}).sort("date", -1).to_list(500)


@api.post("/attendance", dependencies=[Depends(auth_check)])
async def upsert_attendance(body: AttendanceCreate):
    existing = await db.attendance.find_one({"staffId": body.staffId, "date": body.date}, {"_id": 0})
    if existing:
        await db.attendance.update_one({"id": existing["id"]}, {"$set": {"status": body.status}})
        return {**existing, "status": body.status}
    a = Attendance(**body.model_dump())
    await db.attendance.insert_one(a.model_dump())
    return a.model_dump()


# ----- WhatsApp Outbox -----
@api.get("/whatsapp/messages", dependencies=[Depends(auth_check)])
async def list_wa(status: str = "all"):
    q = {} if status == "all" else {"status": status}
    return await db.whatsapp_messages.find(q, {"_id": 0}).sort("createdAt", -1).to_list(500)


@api.post("/whatsapp/send", dependencies=[Depends(auth_check)])
async def wa_send_body(body: dict):
    msg = await queue_whatsapp(
        to_number=body.get("toNumber", ""),
        body=body.get("body", ""),
        category=body.get("category", "manual"),
        patient_id=body.get("patientId"),
        patient_name=body.get("patientName", ""),
    )
    return msg.model_dump()


@api.post("/whatsapp/messages/{mid}/mark-sent", dependencies=[Depends(auth_check)])
async def wa_mark_sent(mid: str):
    r = await db.whatsapp_messages.update_one({"id": mid}, {"$set": {"status": "sent", "sentAt": iso(now())}})
    if r.matched_count == 0:
        raise HTTPException(404, "Message not found")
    return await db.whatsapp_messages.find_one({"id": mid}, {"_id": 0})


@api.post("/whatsapp/messages/{mid}/mark-failed", dependencies=[Depends(auth_check)])
async def wa_mark_failed(mid: str, body: dict = None):
    err = (body or {}).get("error", "Delivery failed")
    r = await db.whatsapp_messages.update_one({"id": mid}, {"$set": {"status": "failed", "error": err}})
    if r.matched_count == 0:
        raise HTTPException(404, "Message not found")
    return await db.whatsapp_messages.find_one({"id": mid}, {"_id": 0})


@api.delete("/whatsapp/messages/{mid}", dependencies=[Depends(auth_check)])
async def wa_delete(mid: str):
    await db.whatsapp_messages.delete_one({"id": mid})
    return {"success": True}


# ----- Reports -----
@api.get("/reports/summary", dependencies=[Depends(auth_check)])
async def reports_summary(startDate: Optional[str] = None, endDate: Optional[str] = None):
    rng = {}
    if startDate:
        rng["$gte"] = ist_start(date.fromisoformat(startDate))
    if endDate:
        rng["$lt"] = ist_start(date.fromisoformat(endDate) + timedelta(days=1))
    bill_q = {"status": {"$ne": "cancelled"}, **({"invoiceDate": rng} if rng else {})}
    bills = await db.bills.find(bill_q, {"_id": 0}).to_list(5000)
    opd_q = {"visitDate": rng} if rng else {}
    opd_count = await db.opd_visits.count_documents(opd_q)
    return {
        "bills": len(bills),
        "revenue": round(sum(b.get("total", 0) for b in bills), 2),
        "opdVisits": opd_count,
        "ipdCurrent": await db.ipd_admissions.count_documents({"status": "admitted"}),
        "referrals": await db.referrals.count_documents({}),
    }


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_indexes():
    await refresh_cfg_globals()
    for name, col, field, prefix in (("bill", "bills", "invoiceNumber", "INV-"),):
        nums = [int(d[field].replace(prefix, "")) - 1000 async for d in db[col].find({}, {field: 1}) if d.get(field, "").replace(prefix, "").isdigit()]
        if nums:
            await db.counters.update_one({"_id": name}, {"$max": {"seq": max(nums)}}, upsert=True)
    try:
        await db.medicines.create_index([("name", 1)])
        await db.bills.create_index([("invoiceDate", -1)])
        await db.opd_visits.create_index([("visitDate", -1)])
        await db.ipd_admissions.create_index([("status", 1)])
        await db.whatsapp_messages.create_index([("status", 1), ("createdAt", -1)])
        await db.patient_notes.create_index([("patientId", 1), ("date", -1)])
        await db.files.create_index([("id", 1)], unique=True)
        await db.sessions.create_index([("token", 1)])
        await db.ipd_items.create_index([("patientId", 1)])
        await db.family_dispatches.create_index([("date", -1)])
    except Exception as e:
        logger.error("index err: %s", e)


@app.on_event("shutdown")
async def shutdown():
    client.close()
