import logging
import sys
import os

# Fix Windows console UTF-8 emoji encoding
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from telegram import (
    Update,
    WebAppInfo,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
)
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

import config

# Logging setup
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger("ArrowsBot")


def get_main_keyboard() -> InlineKeyboardMarkup:
    """Builds inline keyboard with Telegram WebApp launcher and helper buttons."""
    keyboard = [
        [
            InlineKeyboardButton(
                text="🎮 Play Arrows Game",
                web_app=WebAppInfo(url=config.WEBAPP_URL)
            )
        ],
        [
            InlineKeyboardButton(text="📖 How to Play", callback_data="btn_rules"),
            InlineKeyboardButton(text="🏆 5000 Levels", callback_data="btn_levels"),
        ],
        [
            InlineKeyboardButton(text="⚡ Tips & Tricks", callback_data="btn_tips"),
        ]
    ]
    return InlineKeyboardMarkup(keyboard)


async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles the /start command."""
    user = update.effective_user
    chat_id = update.effective_chat.id
    first_name = user.first_name if user else "Player"

    # Configure the persistent chat menu button (bottom-left next to text bar)
    try:
        await context.bot.set_chat_menu_button(
            chat_id=chat_id,
            menu_button=MenuButtonWebApp(
                text="🎮 Play Game",
                web_app=WebAppInfo(url=config.WEBAPP_URL)
            )
        )
    except Exception as e:
        logger.warning(f"Could not set chat menu button: {e}")

    welcome_text = (
        f"👋 **Namaste {first_name}! Welcome to Arrows Puzzle!** 🎯\n\n"
        "**Arrows — Logic Maze Puzzle Game**\n"
        "Ek mind-bending puzzle game jisme aapko winding arrow maze ko solve karna hai!\n\n"
        "🧩 **Game Highlights:**\n"
        "• **5,000 Solvable Levels** (Hard se lekar Nightmare tak)\n"
        "• **Smooth Haptic Feedback** (Telegram mobile par real vibrations)\n"
        "• **Sound Effects & Confetti** on Victory\n"
        "• **Zoom & Pan Controls** for massive boss mazes\n\n"
        "Niche diye button par click karke game shuru karein 👇"
    )

    await update.message.reply_text(
        text=welcome_text,
        reply_markup=get_main_keyboard(),
        parse_mode="Markdown"
    )


async def play_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles the /play command."""
    await update.message.reply_text(
        text="👇 Click below to open **Arrows** right inside Telegram:",
        reply_markup=InlineKeyboardMarkup([
            [
                InlineKeyboardButton(
                    text="🎮 Play Arrows Game",
                    web_app=WebAppInfo(url=config.WEBAPP_URL)
                )
            ]
        ]),
        parse_mode="Markdown"
    )


async def help_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles the /help command."""
    help_text = (
        "🎯 **How to Play Arrows:**\n\n"
        "1. **Shoot Arrows:** Kisi bhi arrow par tap karein. Arrow apne head ke direction me shoot karegi.\n"
        "2. **Clear Path Required:** Arrow tabhi bahar niklegi jab uske aage ka rasta bilkul saaf ho! Agar samne dusri arrow hogi, toh takkar hogi aur ek ❤️ chala jayega.\n"
        "3. **3 Hearts:** Har level par aapke paas 3 hearts hote hain. Galat move se heart kam hota hai.\n"
        "4. **Hints & Steps:**\n"
        "   • 💡 **Hint:** Ek safe arrow ko highlight karta hai.\n"
        "   • ⚡ **Step:** Ek arrow ko automatically clear karta hai (3 per level).\n"
        "5. **Zoom & Pan:** 2 fingers se pinch zoom karein ya drag karke board ko move karein.\n"
        "6. **'#' Button:** Grid lines aur arrow exit trajectory guides on/off karein."
    )
    await update.message.reply_text(
        text=help_text,
        reply_markup=get_main_keyboard(),
        parse_mode="Markdown"
    )


async def levels_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles the /levels command."""
    levels_text = (
        "🏆 **Arrows Game - 5,000 Levels Info:**\n\n"
        "• **Level 1:** Classic Hard Maze (14×18 grid)\n"
        "• **Level 2:** Giant Shield Boss (19×21 grid)\n"
        "• **Level 100+:** Expert Tier (Complex twists & bends)\n"
        "• **Level 500+:** Master Tier (Deep interlocking citadels)\n"
        "• **Level 2,000+:** Grandmaster Tier\n"
        "• **Level 4,000 - 5,000:** Nightmare Tier 🔥\n\n"
        "Har level mathematically guaranteed solvable hai! Aap kisi bhi level number par direct jump kar sakte hain."
    )
    await update.message.reply_text(
        text=levels_text,
        reply_markup=get_main_keyboard(),
        parse_mode="Markdown"
    )


async def callback_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles button clicks on inline messages."""
    query = update.callback_query
    await query.answer()

    if query.data == "btn_rules":
        await query.message.reply_text(
            text=(
                "📖 **Rules of the Game:**\n"
                "• Arrow tabhi exit karegi jab uske aage ka pura path clear ho.\n"
                "• 3 hearts ❤️ limit.\n"
                "• Sabhi arrows ko board se bahar nikal kar jeetein!"
            ),
            reply_markup=get_main_keyboard(),
            parse_mode="Markdown"
        )
    elif query.data == "btn_levels":
        await query.message.reply_text(
            text=(
                "🏆 **5,000 Levels Available:**\n"
                "Game ke andar top-left '←' button par tap karke aap Level 1 se lekar 5000 tak kisi bhi level ko select kar sakte hain!"
            ),
            reply_markup=get_main_keyboard(),
            parse_mode="Markdown"
        )
    elif query.data == "btn_tips":
        await query.message.reply_text(
            text=(
                "⚡ **Pro Tips:**\n"
                "• Hamesha bahar ki border par jo arrows hain unko pehle dekhein.\n"
                "• Bottom-right '#' button daba kar exit guide lines on karein.\n"
                "• Agar fas jayein toh Hint (💡) ya Auto-Step (⚡) use karein."
            ),
            reply_markup=get_main_keyboard(),
            parse_mode="Markdown"
        )


async def webapp_data_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles data sent back from the Web App if applicable."""
    if update.effective_message and update.effective_message.web_app_data:
        data = update.effective_message.web_app_data.data
        logger.info(f"Received data from WebApp: {data}")
        await update.effective_message.reply_text(
            f"🎉 Received game data: `{data}`",
            parse_mode="Markdown"
        )


def main():
    if not config.BOT_TOKEN or config.BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        print("\n" + "=" * 60)
        print("❌ ERROR: BOT_TOKEN is missing or not configured!")
        print("=" * 60)
        print("Kripya `.env` file me apna Telegram Bot Token daalein:")
        print("BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRstuVWXyz\n")
        print("Bot Token paane ke liye:")
        print("1. Telegram par @BotFather search karein.")
        print("2. /newbot command bhej kar naya bot banayein.")
        print("3. Milaye gaye token ko `.env` file me paste karein.\n")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("🚀 Starting Arrows Telegram Bot...")
    print(f"🔗 WebApp URL configured: {config.WEBAPP_URL}")
    print("=" * 60)

    # Initialize Telegram Application
    app = Application.builder().token(config.BOT_TOKEN).build()

    # Register handlers
    app.add_handler(CommandHandler("start", start_handler))
    app.add_handler(CommandHandler("play", play_handler))
    app.add_handler(CommandHandler("game", play_handler))
    app.add_handler(CommandHandler("help", help_handler))
    app.add_handler(CommandHandler("levels", levels_handler))
    app.add_handler(CallbackQueryHandler(callback_query_handler))
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, webapp_data_handler))

    # Run bot polling
    print("✅ Bot is now polling Telegram for messages... Press Ctrl+C to stop.\n")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
