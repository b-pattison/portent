class Campaign < ApplicationRecord
  belongs_to :user
  has_many :characters, dependent: :destroy
  validates :name, presence: true
  validates :name, uniqueness: {scope: :user_id}
  validates :name, length: {minimum: 3, maximum: 255}
end
