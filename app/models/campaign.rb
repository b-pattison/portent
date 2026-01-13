class Campaign < ApplicationRecord
  belongs_to :user
  validates :name, present: true
  validates :name, uniqueness: {scope: :user_id}
  validates :name, length: {minimum: 3, maximum: 255}
end
