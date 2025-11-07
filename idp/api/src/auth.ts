import * as crypto from "crypto";
import passport, { use } from 'passport';
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt"

import { User } from "./sqlite";

const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(20).toString('hex');

passport.use(new LocalStrategy({session: false}, async (username, password, cb) => {
    try {
        const user = await User.findOne({
            where: { username, password }
        });
        if (user === null) {
            return cb(null, false, { message: 'Incorrect username or password.' })
        } else {
            user.username
            return cb(null, user);
        }
    } catch(err) {
        return cb(err)
    }
}));

passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: jwtSecret,
}, async(jwt_payload, done) => {
    try {
        const user = await User.findOne({
            where: { username: jwt_payload.sub }
        })
        return done(null, user || false);
    } catch (err) {
        return done(err, false)
    }
}));

export {
    jwtSecret
}