import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../Models/user.mjs";
import {
	generateAccessToken,
	generateRefreshToken,
} from "../Controllers/auth.mjs";
import dotenv from "dotenv";

dotenv.config();

passport.use(
	new GoogleStrategy(
		{
			clientID: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			callbackURL: "http://localhost:8080/api/auth/google/callback",
		},
		async (accessToken, refreshToken, profile, done) => {
			try {
				let user = await User.findOne({ email: profile.emails[0].value });
				if (!user) {
					user = new User({
						email: profile.emails[0].value,
						name: profile.displayName,
					});
					await user.save();
				}
				const jwtAccessToken = generateAccessToken({
					email: user.email,
					id: user._id,
				});

				const jwtRefreshToken = generateRefreshToken({
					email: user.email,
					id: user._id,
				});
				return done(null, {
					accessToken: jwtAccessToken,
					refreshToken: jwtRefreshToken,
					user,
				});
			} catch (err) {
				return done(err, null);
			}
		}
	)
);

// Not using sessions, but required to prevent errors
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

export default passport;
