const crypto = require("crypto");
const ChatConversation = require("../models/ChatConversation");
const ChatMessage = require("../models/ChatMessage");
const { generateReply } = require("../utils/chatBot");

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 20;
const rateBuckets = new Map();

function isRateLimited(key) {
    const now = Date.now();
    const recent = (rateBuckets.get(key) || []).filter(function (t) {
        return now - t < RATE_WINDOW_MS;
    });

    if (recent.length >= RATE_MAX) {
        rateBuckets.set(key, recent);
        return true;
    }

    recent.push(now);
    rateBuckets.set(key, recent);

    if (rateBuckets.size > 2000) {
        rateBuckets.forEach(function (times, k) {
            if (!times.some(function (t) { return now - t < RATE_WINDOW_MS; })) {
                rateBuckets.delete(k);
            }
        });
    }

    return false;
}

function mapMessage(m) {
    return {
        id: String(m._id),
        clientId: m.clientId || "",
        sender: m.sender,
        senderName: m.senderName || "",
        text: m.text,
        at: m.createdAt
    };
}

/* ======================================================
   PUBLIC - VISITOR CHAT (JSON)
====================================================== */

async function getConversation(req) {
    if (!req.session.chatId) {
        req.session.chatId = crypto.randomBytes(12).toString("hex");
    }

    const customer = req.session.customer || null;
    const customerId = customer && customer.id ? customer.id : null;

    let convo = await ChatConversation.findOne({ visitorKey: req.session.chatId })
        .sort({ createdAt: 1 });

    if (!convo) {
        convo = await ChatConversation.create({
            visitorKey: req.session.chatId,
            customer: customerId,
            displayName: (customer && customer.name) || "Guest"
        });
        return convo;
    }

    if (customerId && (!convo.customer || convo.displayName === "Guest")) {
        convo.customer = customerId;
        if (customer.name) convo.displayName = customer.name;
        await convo.save();
    }

    return convo;
}

exports.postMessage = async (req, res) => {
    try {
        if (isRateLimited("chat:" + (req.session.chatId || req.ip))) {
            return res.status(429).json({
                ok: false,
                error: "Too many messages. Please wait a minute and try again."
            });
        }

        const text = String(req.body.text || "").trim().slice(0, 2000);
        const clientId = String(req.body.clientId || "").trim().slice(0, 80);

        if (!text) {
            return res.json({ ok: false, error: "Message is empty." });
        }

        const convo = await getConversation(req);

        if (clientId) {
            const duplicate = await ChatMessage.findOne({
                conversation: convo._id,
                sender: "visitor",
                clientId
            }).lean();

            if (duplicate) {
                return res.json({
                    ok: true,
                    duplicate: true,
                    mode: convo.mode,
                    reply: null,
                    message: mapMessage(duplicate)
                });
            }
        }

        const visitorMessage = await ChatMessage.create({
            conversation: convo._id,
            sender: "visitor",
            senderName: convo.displayName,
            text,
            clientId
        });

        const now = new Date();
        let mode = convo.mode;
        let botMessage = null;

        if (mode === "bot") {
            const recent = await ChatMessage.find({ conversation: convo._id })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();

            recent.reverse();

            const history = recent
                .filter(function (m) { return String(m._id) !== String(visitorMessage._id); })
                .map(function (m) { return { sender: m.sender, text: m.text }; });

            const result = await generateReply(text, {
                state: convo.botState,
                history
            });

            /* Only post the bot answer if an admin has not taken over while
               the answer was being generated. */
            const conversationUpdate = {
                $set: {
                    lastMessage: text.slice(0, 300),
                    lastMessageAt: now,
                    botState: result.state || {}
                },
                $inc: { unreadAdmin: 1 }
            };

            if (result.handoff) {
                conversationUpdate.$set.mode = "human";
                conversationUpdate.$set.modeChangedAt = now;
                conversationUpdate.$set.modeChangedBy = "Assistant";
            }

            const claimed = await ChatConversation.findOneAndUpdate(
                { _id: convo._id, mode: "bot" },
                conversationUpdate,
                { new: true }
            );

            if (claimed) {
                mode = claimed.mode;

                if (result.reply) {
                    botMessage = await ChatMessage.create({
                        conversation: convo._id,
                        sender: "bot",
                        senderName: "Assistant",
                        text: result.reply
                    });
                }
            } else {
                const current = await ChatConversation.findById(convo._id).select("mode").lean();
                mode = (current && current.mode) || "human";

                await ChatConversation.updateOne(
                    { _id: convo._id },
                    {
                        $set: {
                            lastMessage: text.slice(0, 300),
                            lastMessageAt: now
                        },
                        $inc: { unreadAdmin: 1 }
                    }
                );
            }
        } else {
            await ChatConversation.updateOne(
                { _id: convo._id },
                {
                    $set: {
                        lastMessage: text.slice(0, 300),
                        lastMessageAt: now
                    },
                    $inc: { unreadAdmin: 1 }
                }
            );
        }

        return res.json({
            ok: true,
            mode,
            reply: botMessage ? mapMessage(botMessage) : null,
            message: mapMessage(visitorMessage),
            conversationId: String(convo._id)
        });
    } catch (error) {
        console.error("Chat message error:", error);
        return res.json({ ok: false, error: "Chat is unavailable right now." });
    }
};

exports.getMessages = async (req, res) => {
    try {
        if (!req.session.chatId) {
            return res.json({ ok: true, mode: "bot", messages: [] });
        }

        const convo = await ChatConversation.findOne({ visitorKey: req.session.chatId })
            .sort({ createdAt: 1 })
            .lean();

        if (!convo) {
            return res.json({ ok: true, mode: "bot", messages: [] });
        }

        const latest = await ChatMessage.find({ conversation: convo._id })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        latest.reverse();

        return res.json({
            ok: true,
            mode: convo.mode,
            messages: latest.map(mapMessage)
        });
    } catch (error) {
        console.error("Chat fetch error:", error);
        return res.json({ ok: false, error: "Chat is unavailable right now." });
    }
};

/* ======================================================
   ADMIN - CONVERSATIONS
====================================================== */

exports.getChats = async (req, res) => {
    try {
        const conversations = await ChatConversation.find({})
            .sort({ lastMessageAt: -1 })
            .limit(100)
            .lean();

        const totalHuman = await ChatConversation.countDocuments({ mode: "human" });
        const totalUnread = await ChatConversation.countDocuments({ unreadAdmin: { $gt: 0 } });

        return res.render("admin/chats", {
            pageTitle: "Live Chats",
            conversations,
            totalHuman,
            totalUnread
        });
    } catch (error) {
        console.error("Admin chats list error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.getChatDetail = async (req, res) => {
    try {
        const convo = await ChatConversation.findById(req.params.id).lean();
        if (!convo) {
            return res.status(404).send("Conversation not found.");
        }

        const messages = await ChatMessage.find({ conversation: convo._id })
            .sort({ createdAt: 1 })
            .lean();

        if (convo.unreadAdmin > 0) {
            await ChatConversation.updateOne({ _id: convo._id }, { $set: { unreadAdmin: 0 } });
        }

        return res.render("admin/chatDetail", {
            pageTitle: "Live Chat | " + convo.displayName,
            convo,
            messages,
            adminName: (req.session.admin && (req.session.admin.name || req.session.admin.email)) || "Team"
        });
    } catch (error) {
        console.error("Admin chat detail error:", error);
        return res.status(500).render("errors/500");
    }
};

exports.getChatMessagesJson = async (req, res) => {
    try {
        const convo = await ChatConversation.findById(req.params.id).select("mode unreadAdmin").lean();

        const latest = await ChatMessage.find({ conversation: req.params.id })
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        latest.reverse();

        if (convo && convo.unreadAdmin > 0) {
            await ChatConversation.updateOne(
                { _id: req.params.id, unreadAdmin: { $gt: 0 } },
                { $set: { unreadAdmin: 0 } }
            );
        }

        return res.json({
            ok: true,
            mode: convo ? convo.mode : "bot",
            messages: latest.map(mapMessage)
        });
    } catch (error) {
        console.error("Admin chat poll error:", error);
        return res.json({ ok: false });
    }
};

exports.postAdminReply = async (req, res) => {
    try {
        const text = String(req.body.text || "").trim().slice(0, 2000);
        if (!text) {
            return res.redirect("/admin/chats/" + req.params.id);
        }

        const senderName =
            (req.session.admin && (req.session.admin.name || req.session.admin.email)) || "Team";

        /* Take the conversation out of bot mode before saving the reply, so a
           reply that is already being generated cannot be posted afterwards. */
        const convo = await ChatConversation.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    mode: "human",
                    modeChangedAt: new Date(),
                    modeChangedBy: senderName,
                    lastMessage: text.slice(0, 300),
                    lastMessageAt: new Date(),
                    unreadAdmin: 0
                }
            },
            { new: true }
        );

        if (!convo) {
            return res.status(404).send("Conversation not found.");
        }

        await ChatMessage.create({
            conversation: convo._id,
            sender: "admin",
            senderName,
            text
        });

        return res.redirect("/admin/chats/" + req.params.id);
    } catch (error) {
        console.error("Admin chat reply error:", error);
        return res.status(500).send("Unable to send the reply.");
    }
};

exports.deleteChat = async (req, res) => {
    try {
        const convo = await ChatConversation.findById(req.params.id).select("_id").lean();
        if (!convo) {
            return res.status(404).send("Conversation not found.");
        }

        await ChatMessage.deleteMany({ conversation: convo._id });
        await ChatConversation.deleteOne({ _id: convo._id });

        return res.redirect("/admin/chats");
    } catch (error) {
        console.error("Admin chat delete error:", error);
        return res.status(500).send("Unable to delete the conversation.");
    }
};


exports.toggleBotMode = async (req, res) => {
    try {
        const convo = await ChatConversation.findById(req.params.id);
        if (!convo) {
            return res.status(404).send("Conversation not found.");
        }

        const requested = String(req.body.mode || "").trim();
        const next = requested === "bot" || requested === "human"
            ? requested
            : (convo.mode === "bot" ? "human" : "bot");

        if (next !== convo.mode) {
            convo.mode = next;
            convo.modeChangedAt = new Date();
            convo.modeChangedBy =
                (req.session.admin && (req.session.admin.name || req.session.admin.email)) || "Team";

            if (next === "bot") {
                convo.botState = {};
            }

            await convo.save();

            if (next === "bot") {
                await ChatMessage.create({
                    conversation: convo._id,
                    sender: "bot",
                    senderName: "Assistant",
                    text: "The MizanTrade assistant is active again. Ask me about products, prices, stock, delivery, payment or warranty."
                });
            }
        }

        return res.redirect("/admin/chats/" + req.params.id);
    } catch (error) {
        console.error("Toggle chat mode error:", error);
        return res.status(500).send("Unable to update chat mode.");
    }
};
