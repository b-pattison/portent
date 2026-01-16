# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_01_16_200143) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "campaigns", force: :cascade do |t|
    t.string "name", null: false
    t.bigint "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_campaigns_on_user_id"
  end

  create_table "characters", force: :cascade do |t|
    t.bigint "campaign_id", null: false
    t.string "name", null: false
    t.integer "initiative_mod", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "pc", default: true, null: false
    t.boolean "temporary", default: false, null: false
    t.index ["campaign_id"], name: "index_characters_on_campaign_id"
  end

  create_table "encounter_effect_targets", force: :cascade do |t|
    t.bigint "encounter_effect_id", null: false
    t.bigint "encounter_participant_id", null: false
    t.integer "trigger_timing", default: 0, null: false
    t.boolean "active", default: true, null: false
    t.datetime "ended_at"
    t.datetime "last_prompted_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "death_save_successes", default: 0, null: false
    t.integer "death_save_failures", default: 0, null: false
    t.index ["encounter_effect_id", "encounter_participant_id"], name: "idx_effect_target_uniqueness", unique: true
    t.index ["encounter_effect_id"], name: "index_encounter_effect_targets_on_encounter_effect_id"
    t.index ["encounter_participant_id"], name: "index_encounter_effect_targets_on_encounter_participant_id"
  end

  create_table "encounter_effects", force: :cascade do |t|
    t.bigint "encounter_id", null: false
    t.string "name", default: "Effect", null: false
    t.text "note"
    t.integer "duration_type", default: 0, null: false
    t.integer "duration_rounds"
    t.integer "expires_on_round"
    t.bigint "expires_on_participant_id"
    t.integer "save_ability"
    t.integer "hp_delta", default: 0, null: false
    t.datetime "ended_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["encounter_id"], name: "index_encounter_effects_on_encounter_id"
    t.index ["ended_at"], name: "index_encounter_effects_on_ended_at"
    t.index ["expires_on_participant_id"], name: "index_encounter_effects_on_expires_on_participant_id"
  end

  create_table "encounter_participants", force: :cascade do |t|
    t.bigint "encounter_id", null: false
    t.bigint "character_id", null: false
    t.integer "initiative_roll"
    t.integer "initiative_mod"
    t.integer "initiative_total"
    t.string "state", default: "alive", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "added_in_round"
    t.index ["character_id"], name: "index_encounter_participants_on_character_id"
    t.index ["encounter_id", "character_id"], name: "index_encounter_participants_on_encounter_id_and_character_id", unique: true
    t.index ["encounter_id"], name: "index_encounter_participants_on_encounter_id"
  end

  create_table "encounters", force: :cascade do |t|
    t.bigint "campaign_id", null: false
    t.string "status", default: "setup", null: false
    t.integer "round_number", default: 1, null: false
    t.bigint "active_participant_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "last_active_participant_id"
    t.index ["active_participant_id"], name: "index_encounters_on_active_participant_id"
    t.index ["campaign_id"], name: "index_encounters_on_campaign_id"
    t.index ["last_active_participant_id"], name: "index_encounters_on_last_active_participant_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "campaigns", "users"
  add_foreign_key "characters", "campaigns"
  add_foreign_key "encounter_effect_targets", "encounter_effects"
  add_foreign_key "encounter_effect_targets", "encounter_participants"
  add_foreign_key "encounter_effects", "encounter_participants", column: "expires_on_participant_id"
  add_foreign_key "encounter_effects", "encounters"
  add_foreign_key "encounter_participants", "characters"
  add_foreign_key "encounter_participants", "encounters"
  add_foreign_key "encounters", "campaigns"
end
